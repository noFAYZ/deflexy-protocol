// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Capabilities} from "../libraries/Capabilities.sol";
import {IPermissionManager, IProfileRegistry} from "../interfaces/Interfaces.sol";

/// @notice Delegated permissions without transferring profile ownership. One
/// active grant per (profile, delegate) keeps `hasPermission` O(1) — the
/// authorization read on every delegated action. Ownership lives in the
/// ProfileRegistry and is never touched here (PermissionManager §1).
contract PermissionManager is IPermissionManager {
    IProfileRegistry public immutable profiles;

    struct Grant {
        uint256 mask; // 0 = no/revoked grant
        uint64 expiration; // 0 = never expires
    }

    // profileId => delegate => grant
    mapping(uint256 => mapping(address => Grant)) private _grants;

    event PermissionGranted(uint256 indexed profileId, address indexed delegate, uint256 mask, uint64 expiration);
    event PermissionRevoked(uint256 indexed profileId, address indexed delegate);

    error NotProfileOwner();
    error InvalidDelegate();
    error InvalidMask();

    constructor(address profileRegistry) {
        profiles = IProfileRegistry(profileRegistry);
    }

    /// @dev Overwrites any prior grant for this delegate (set, don't accumulate).
    function grantPermission(uint256 profileId, address delegate, uint256 mask, uint64 expiration) external {
        if (profiles.ownerOf(profileId) != msg.sender) revert NotProfileOwner();
        if (delegate == address(0) || delegate == msg.sender) revert InvalidDelegate();
        if (mask == 0 || mask & ~Capabilities.ALL != 0) revert InvalidMask(); // must be a non-empty subset
        _grants[profileId][delegate] = Grant(mask, expiration);
        emit PermissionGranted(profileId, delegate, mask, expiration);
    }

    function revokePermission(uint256 profileId, address delegate) external {
        if (profiles.ownerOf(profileId) != msg.sender) revert NotProfileOwner();
        delete _grants[profileId][delegate]; // immediate effect
        emit PermissionRevoked(profileId, delegate);
    }

    /// @inheritdoc IPermissionManager
    function hasPermission(uint256 profileId, address account, uint256 capability)
        external
        view
        returns (bool)
    {
        if (capability == 0) return false;
        Grant storage g = _grants[profileId][account];
        if (g.expiration != 0 && block.timestamp >= g.expiration) return false;
        return (g.mask & capability) == capability;
    }

    function getGrant(uint256 profileId, address delegate) external view returns (Grant memory) {
        return _grants[profileId][delegate];
    }
}
