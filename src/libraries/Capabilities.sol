// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Delegated-permission capability bits (PermissionManager). A grant
/// holds a bitmask; a check passes when `(mask & capability) == capability`.
library Capabilities {
    uint256 internal constant CREATE_JOB = 1 << 0;
    uint256 internal constant CANCEL_JOB = 1 << 1;
    uint256 internal constant SUBMIT_BID = 1 << 2;
    uint256 internal constant ACCEPT_BID = 1 << 3; // create agreement + add work units
    uint256 internal constant FUND_VAULT = 1 << 4;
    uint256 internal constant SUBMIT_WORK = 1 << 5;
    uint256 internal constant APPROVE_WORK = 1 << 6;
    // Dropped OPEN_DISPUTE / MANAGE_PROFILE: no code consulted them, so granting
    // them was a no-op that misled delegators. Re-add (and wire) if delegated
    // dispute-opening / profile management is ever actually implemented.

    /// @dev All defined bits — any grant mask must be a subset of this.
    uint256 internal constant ALL = (1 << 7) - 1;
}
