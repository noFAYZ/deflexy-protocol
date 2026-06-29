// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base, Vm} from "./Base.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {JobRegistry} from "../src/JobRegistry.sol";
import {BidRegistry} from "../src/BidRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {SettlementModel} from "../src/libraries/Types.sol";

/// @dev Drives several agreements across TWO tokens that share the single
/// VaultManager balance, with bounded always-valid ops. The agreements are
/// created in the constructor so the fuzzer only touches the lifecycle actions.
contract MultiHandler {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    AgreementRegistry public agreement;
    VaultManager public vault;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    address public employer;
    address public freelancer;
    address public treasury;

    struct Ag {
        uint256 aid;
        uint256 vaultId;
        address token;
        uint256 total;
        uint256 allocated;
        uint64 seq;
    }

    Ag[] private _ags;

    constructor(
        AgreementRegistry _agreement,
        VaultManager _vault,
        JobRegistry _jobs,
        BidRegistry _bids,
        MockERC20 _tokenA,
        MockERC20 _tokenB,
        uint256 empProfile,
        uint256 freeProfile,
        address _employer,
        address _freelancer,
        address _treasury
    ) {
        agreement = _agreement;
        vault = _vault;
        tokenA = _tokenA;
        tokenB = _tokenB;
        employer = _employer;
        freelancer = _freelancer;
        treasury = _treasury;

        _create(_jobs, _bids, empProfile, freeProfile, address(_tokenA), 500e21);
        _create(_jobs, _bids, empProfile, freeProfile, address(_tokenB), 500e21);
        _create(_jobs, _bids, empProfile, freeProfile, address(_tokenA), 300e21);
        _create(_jobs, _bids, empProfile, freeProfile, address(_tokenB), 300e21);
    }

    function _create(
        JobRegistry jobs,
        BidRegistry bids,
        uint256 empProfile,
        uint256 freeProfile,
        address token,
        uint256 total
    ) private {
        vm.prank(employer);
        uint256 jobId = jobs.createJob(empProfile, token, total, SettlementModel.MILESTONE, bytes32(0));
        vm.prank(freelancer);
        uint256 bidId = bids.submitBid(jobId, freeProfile, total, 0, bytes32(0));
        vm.prank(employer);
        uint256 aid = agreement.createAgreement(jobId, bidId);
        _ags.push(Ag(aid, agreement.getAgreement(aid).vaultId, token, total, 0, 0));
    }

    function count() external view returns (uint256) {
        return _ags.length;
    }

    function vaultIdAt(uint256 i) external view returns (uint256) {
        return _ags[i].vaultId;
    }

    function tokenAt(uint256 i) external view returns (address) {
        return _ags[i].token;
    }

    // ---- fuzzed actions (bounded, always valid) ----

    function fund(uint256 idx, uint256 amt) external {
        Ag storage a = _ags[idx % _ags.length];
        amt = 1 + (amt % a.total);
        MockERC20 t = MockERC20(a.token);
        t.mint(employer, amt);
        vm.prank(employer);
        t.approve(address(vault), type(uint256).max);
        vm.prank(employer);
        agreement.fundVault(a.aid, amt);
    }

    function settleUnit(uint256 idx, uint256 amt) external {
        Ag storage a = _ags[idx % _ags.length];
        uint256 avail = vault.available(a.vaultId);
        uint256 rem = a.total - a.allocated;
        uint256 cap = avail < rem ? avail : rem;
        if (cap == 0) return;
        amt = 1 + (amt % cap);

        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(a.aid, ++a.seq, amt, bytes32(0));
        a.allocated += amt;
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, bytes32(0));
        vm.prank(employer);
        agreement.approveWork(wu);
        agreement.settleWorkUnit(wu);
    }

    function cancelStale(uint256 idx, uint256 amt) external {
        Ag storage a = _ags[idx % _ags.length];
        uint256 rem = a.total - a.allocated;
        if (rem == 0) return;
        amt = 1 + (amt % rem);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(a.aid, ++a.seq, amt, bytes32(0));
        a.allocated += amt;
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        a.allocated -= amt;
    }

    function withdraw(uint256 who, uint256 tok) external {
        address t = tok % 2 == 0 ? address(tokenA) : address(tokenB);
        address actor = who % 3 == 0 ? freelancer : (who % 3 == 1 ? employer : treasury);
        if (vault.claimable(actor, t) == 0) return;
        vm.prank(actor);
        vault.withdraw(t);
    }
}

/// @notice Global solvency across MANY vaults sharing one balance, in two tokens
/// (one fee'd, one fee-free). For each token: physical balance == summed
/// obligations (per-vault escrow + every claimable) == the O(1) `owed`
/// accumulator. Catches cross-vault / cross-token accounting drift the
/// single-vault invariant can't.
contract InvariantMultiTest is Base {
    MultiHandler handler;
    MockERC20 tokenB;

    function setUp() public {
        deployProtocol();
        tokenB = new MockERC20();
        vault.setTokenAllowed(address(tokenB), true);

        // tokenA charges a fee to treasury; tokenB is fee-free. Snapshotted at
        // each vault's creation inside the handler constructor below.
        fee.setFeeConfig(address(token), 250, treasury, true);

        handler = new MultiHandler(
            agreement, vault, jobs, bidsC, token, tokenB, empProfile, freeProfile, employer, freelancer, treasury
        );
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariant_multiVaultSolvency() public view {
        _checkToken(address(token));
        _checkToken(address(tokenB));
    }

    function _checkToken(address tok) internal view {
        uint256 held = MockERC20(tok).balanceOf(address(vault));
        uint256 obligations = vault.claimable(freelancer, tok) + vault.claimable(employer, tok)
            + vault.claimable(treasury, tok);
        uint256 n = handler.count();
        for (uint256 i = 0; i < n; i++) {
            if (handler.tokenAt(i) == tok) {
                obligations += vault.available(handler.vaultIdAt(i));
            }
        }
        _assert(held == obligations, "multi-vault insolvent");
        _assert(vault.owed(tok) == obligations, "owed accumulator drift (multi)");
    }
}
