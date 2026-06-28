// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZeroAddress} from "./Errors.sol";

/// @notice Set-once wiring of the trusted AgreementRegistry sibling.
///
/// Hardening §3: the AgreementRegistry address used for `onlyAgreementRegistry`
/// checks is wired exactly once at deployment and is then immutable. It is NOT
/// resolved through the Registry, so a mutable discovery directory can never
/// redirect fund-moving authorization.
abstract contract Wired is Ownable {
    address public agreementRegistry;

    error AlreadyWired();
    error NotWired();
    error NotAgreementRegistry();

    event Wiring(address indexed agreementRegistry);

    function wireAgreementRegistry(address registry) external onlyOwner {
        if (agreementRegistry != address(0)) revert AlreadyWired();
        if (registry == address(0)) revert ZeroAddress();
        agreementRegistry = registry;
        emit Wiring(registry);
    }

    modifier onlyAgreementRegistry() {
        if (agreementRegistry == address(0)) revert NotWired();
        if (msg.sender != agreementRegistry) revert NotAgreementRegistry();
        _;
    }
}
