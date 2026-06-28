// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IFeeManager} from "../interfaces/Interfaces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZeroAddress} from "../utils/Errors.sol";

/// @notice Protocol fee POLICY. It deliberately holds no funds — the
/// VaultManager remains the single custody point and splits settlements using
/// `quote`. This keeps one place that can ever move tokens (hardening §10 /
/// FeeManager §1).
contract FeeManager is IFeeManager, Ownable {
    /// @dev Hard ceiling the owner can never exceed (10% = 1000 bps).
    uint16 public constant MAX_FEE_BPS = 1000;
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    struct Config {
        uint16 feeBps;
        address treasury;
        bool enabled;
    }

    mapping(address => Config) private _config; // token => config

    event FeeConfigured(address indexed token, uint16 feeBps, address treasury, bool enabled);

    error InvalidFeeRate();
    error InvalidTreasury();

    constructor(address owner_) Ownable(owner_) {}

    function setFeeConfig(address token, uint16 feeBps, address treasury, bool enabled) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (feeBps > MAX_FEE_BPS) revert InvalidFeeRate();
        if (enabled && treasury == address(0)) revert InvalidTreasury();
        _config[token] = Config(feeBps, treasury, enabled);
        emit FeeConfigured(token, feeBps, treasury, enabled);
    }

    /// @inheritdoc IFeeManager
    function quote(address token, uint256 amount)
        external
        view
        returns (uint256 fee, uint256 net, address treasury)
    {
        Config memory c = _config[token];
        if (!c.enabled || c.feeBps == 0) {
            return (0, amount, address(0));
        }
        fee = (amount * c.feeBps) / BPS_DENOMINATOR; // <= amount since feeBps <= 1000
        net = amount - fee;
        treasury = c.treasury;
    }

    function getConfig(address token) external view returns (Config memory) {
        return _config[token];
    }
}
