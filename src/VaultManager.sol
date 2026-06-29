// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {VaultStatus} from "./libraries/Types.sol";
import {IVaultManager, IFeeManager} from "./interfaces/Interfaces.sol";
import {Wired} from "./utils/Wired.sol";
import {ZeroAddress} from "./utils/Errors.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Escrow and settlement engine — the only contract that custodies
/// tokens. Highest-risk module; hardening §2/§8 applied:
///   - token allowlist (no fee-on-transfer / rebasing / callback surprises)
///   - deposits credited by MEASURED balance delta, never the argument
///   - releases/refunds are PULL: credited to a claimable balance, recipients
///     withdraw themselves (a blacklisting token can't wedge accounting)
contract VaultManager is IVaultManager, Wired, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Hard ceiling mirrored from the FeeManager — a snapshot can never
    /// exceed this even if the policy is later misconfigured.
    uint256 internal constant MAX_FEE_BPS = 1000;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    struct Vault {
        uint256 agreementId;
        address token;
        uint256 deposited;
        uint256 released;
        uint256 refunded;
        VaultStatus status;
        // Fee policy SNAPSHOT taken at creation (§M3). Settlements split against
        // these, so a later setFeeConfig can't retroactively skim live escrow.
        uint16 feeBps;
        address treasury;
    }

    uint256 public vaultCount;
    mapping(uint256 => Vault) private _vaults;
    mapping(address => bool) public allowedToken;
    // recipient => token => claimable amount (pull payments)
    mapping(address => mapping(address => uint256)) public claimable;
    // token => total obligations the contract must hold (escrow + claimables).
    // Rises only on deposit, falls only on withdraw; balance above it is donated
    // dust that no vault accounts for and can be swept without touching user funds.
    mapping(address => uint256) public owed;

    /// @dev Optional fee policy. Zero = no protocol fee. Set once (§3-style
    /// immutability) so it can't be swapped to skim live escrow.
    IFeeManager public feeManager;

    event TokenAllowed(address indexed token, bool allowed);
    event FeeManagerSet(address indexed feeManager);
    event VaultCreated(uint256 indexed vaultId, uint256 indexed agreementId, address token);
    event FundsDeposited(uint256 indexed vaultId, uint256 amount);
    event PaymentReleased(uint256 indexed vaultId, address indexed recipient, uint256 amount);
    event FeeCollected(uint256 indexed vaultId, address indexed treasury, uint256 amount);
    event RefundIssued(uint256 indexed vaultId, address indexed recipient, uint256 amount);
    event Withdrawal(address indexed recipient, address indexed token, uint256 amount);
    event ExcessSwept(address indexed token, address indexed to, uint256 amount);

    error TokenNotAllowed();
    error VaultNotFound();
    error VaultAlreadyExists();
    error InvalidAmount();
    error InsufficientBalance();
    error NothingToWithdraw();
    error NothingToSweep();
    error AlreadySet();

    constructor(address owner_) Ownable(owner_) {}

    // --- governance ---

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        allowedToken[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function setFeeManager(address fm) external onlyOwner {
        if (address(feeManager) != address(0)) revert AlreadySet();
        if (fm == address(0)) revert ZeroAddress();
        feeManager = IFeeManager(fm);
        emit FeeManagerSet(fm);
    }

    // --- AgreementRegistry-only escrow ops ---

    /// @dev One vault per agreement is enforced by the AgreementRegistry, which
    /// calls this exactly once per agreement.
    function createVault(uint256 agreementId, address token)
        external
        onlyAgreementRegistry
        returns (uint256 vaultId)
    {
        if (!allowedToken[token]) revert TokenNotAllowed();
        vaultId = ++vaultCount;

        // Snapshot the fee policy now; settlement uses this, never live config.
        uint16 bps;
        address treasury;
        IFeeManager fm = feeManager;
        if (address(fm) != address(0)) {
            (bps, treasury) = fm.policy(token);
            if (bps > MAX_FEE_BPS) bps = uint16(MAX_FEE_BPS); // defensive clamp
        }

        _vaults[vaultId] = Vault(agreementId, token, 0, 0, 0, VaultStatus.NONE, bps, treasury);
        emit VaultCreated(vaultId, agreementId, token);
    }

    /// @dev Pulls `amount` from `payer` (who approved this contract) and credits
    /// the MEASURED delta. Fee-on-transfer tokens therefore can't desync
    /// accounting — but they also shouldn't be allowlisted.
    function pullDeposit(uint256 vaultId, address payer, uint256 amount)
        external
        onlyAgreementRegistry
        nonReentrant
    {
        Vault storage v = _vaults[vaultId];
        if (v.token == address(0)) revert VaultNotFound();
        if (amount == 0) revert InvalidAmount();

        IERC20 token = IERC20(v.token);
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(payer, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balBefore;
        if (received == 0) revert InvalidAmount();

        v.deposited += received;
        owed[v.token] += received;
        v.status = VaultStatus.FUNDED;
        emit FundsDeposited(vaultId, received);
    }

    /// @dev Releases `amount` (gross) against escrow, splitting an optional
    /// protocol fee to the treasury. Both legs are credited as pull-claimable;
    /// no token leaves the contract here.
    function releasePayment(uint256 vaultId, address recipient, uint256 amount)
        external
        onlyAgreementRegistry
    {
        Vault storage v = _vaults[vaultId];
        if (v.token == address(0)) revert VaultNotFound();
        if (amount == 0) revert InvalidAmount();
        if (_available(v) < amount) revert InsufficientBalance();

        v.released += amount; // gross accounting
        if (_available(v) == 0) v.status = VaultStatus.EXHAUSTED;

        (uint256 fee, uint256 net, address treasury) = _split(v, amount);
        claimable[recipient][v.token] += net;
        if (fee > 0) {
            claimable[treasury][v.token] += fee;
            emit FeeCollected(vaultId, treasury, fee);
        }
        emit PaymentReleased(vaultId, recipient, amount);
    }

    function refund(uint256 vaultId, address recipient, uint256 amount) external onlyAgreementRegistry {
        Vault storage v = _vaults[vaultId];
        if (v.token == address(0)) revert VaultNotFound();
        if (amount == 0) revert InvalidAmount();
        if (_available(v) < amount) revert InsufficientBalance();

        v.refunded += amount;
        if (_available(v) == 0 && v.status != VaultStatus.EXHAUSTED) v.status = VaultStatus.REFUNDED;
        claimable[recipient][v.token] += amount;
        emit RefundIssued(vaultId, recipient, amount);
    }

    // --- recipient pull ---

    function withdraw(address token) external nonReentrant {
        uint256 amount = claimable[msg.sender][token];
        if (amount == 0) revert NothingToWithdraw();
        claimable[msg.sender][token] = 0; // effects before interaction
        owed[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawal(msg.sender, token, amount);
    }

    /// @dev Sweep tokens the contract holds beyond its obligations — i.e. direct
    /// donations that no vault accounts for. Can never touch escrow or pending
    /// claimables, since `owed` reserves every cent the protocol owes.
    function sweep(address token, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = IERC20(token).balanceOf(address(this));
        uint256 reserved = owed[token];
        if (bal <= reserved) revert NothingToSweep();
        uint256 excess = bal - reserved;
        IERC20(token).safeTransfer(to, excess);
        emit ExcessSwept(token, to, excess);
    }

    // --- views ---

    function available(uint256 vaultId) external view returns (uint256) {
        Vault storage v = _vaults[vaultId];
        if (v.token == address(0)) revert VaultNotFound();
        return _available(v);
    }

    function getVault(uint256 vaultId) external view returns (Vault memory) {
        if (_vaults[vaultId].token == address(0)) revert VaultNotFound();
        return _vaults[vaultId];
    }

    /// @dev Invariant: deposited = released + refunded + available, always ≥ 0.
    function _available(Vault storage v) private view returns (uint256) {
        return v.deposited - v.released - v.refunded;
    }

    /// @dev Fee split from the vault's CREATION-TIME snapshot (not live config).
    /// Defensive: a zero treasury or out-of-range bps degrades to no fee, so a
    /// snapshot can never burn funds or skim more than the ceiling.
    function _split(Vault storage v, uint256 amount)
        private
        view
        returns (uint256 fee, uint256 net, address treasury)
    {
        uint256 bps = v.feeBps;
        treasury = v.treasury;
        if (bps == 0 || bps > MAX_FEE_BPS || treasury == address(0)) {
            return (0, amount, address(0));
        }
        fee = (amount * bps) / BPS_DENOMINATOR; // <= 10% since bps <= MAX_FEE_BPS
        net = amount - fee;
    }
}
