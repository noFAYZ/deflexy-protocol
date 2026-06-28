// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {JobRegistry} from "../src/JobRegistry.sol";
import {BidRegistry} from "../src/BidRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {WorkUnitManager} from "../src/WorkUnitManager.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {FeeManager} from "../src/extensions/FeeManager.sol";
import {DisputeManager} from "../src/extensions/DisputeManager.sol";
import {PermissionManager} from "../src/extensions/PermissionManager.sol";

/// @notice Full deterministic deployment + wiring of Deflexy Protocol.
///
/// Order matters: the dumb stores are deployed first, the AgreementRegistry
/// last (it takes their addresses), then each store is wired set-once to trust
/// that AgreementRegistry. Extensions are deployed and wired afterwards. The
/// Registry is a discovery directory only — it is never an authorization source
/// (hardening §3).
///
/// Env:
///   PRIVATE_KEY    (optional) deployer key; falls back to the default sender.
///   PROTOCOL_OWNER (optional) owner/guardian/arbitrator; defaults to deployer.
///   PAYMENT_TOKEN  (optional) ERC-20 to allowlist immediately.
contract Deploy is Script {
    // Stored in state (not stack) to keep `run()` within stack limits and to
    // expose the addresses to integration tests after deployment.
    Registry public registry;
    ProfileRegistry public profiles;
    JobRegistry public jobs;
    BidRegistry public bids;
    VaultManager public vault;
    WorkUnitManager public work;
    ReputationRegistry public rep;
    AgreementRegistry public agreement;
    FeeManager public fee;
    DisputeManager public dispute;
    PermissionManager public perm;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pk != 0 ? vm.addr(pk) : msg.sender;
        address owner = vm.envOr("PROTOCOL_OWNER", deployer);

        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast();

        // --- core ---
        registry = new Registry(owner);
        profiles = new ProfileRegistry();
        jobs = new JobRegistry(owner, address(profiles));
        bids = new BidRegistry(owner, address(profiles), address(jobs));
        vault = new VaultManager(owner);
        work = new WorkUnitManager(owner);
        rep = new ReputationRegistry(owner);
        agreement = new AgreementRegistry(
            owner, address(profiles), address(jobs), address(bids), address(vault), address(work), address(rep)
        );

        // --- wire trusted sibling (set-once) ---
        jobs.wireAgreementRegistry(address(agreement));
        bids.wireAgreementRegistry(address(agreement));
        vault.wireAgreementRegistry(address(agreement));
        work.wireAgreementRegistry(address(agreement));
        rep.wireAgreementRegistry(address(agreement));

        // --- extensions ---
        fee = new FeeManager(owner);
        perm = new PermissionManager(address(profiles));
        dispute = new DisputeManager(owner, address(agreement), address(profiles)); // owner = arbitrator

        vault.setFeeManager(address(fee));
        agreement.setDisputeManager(address(dispute));
        agreement.setPermissionManager(address(perm));
        jobs.setPermissionManager(address(perm));
        bids.setPermissionManager(address(perm));

        // --- discovery directory (non-authoritative) ---
        registry.registerModule("ProfileRegistry", address(profiles));
        registry.registerModule("JobRegistry", address(jobs));
        registry.registerModule("BidRegistry", address(bids));
        registry.registerModule("AgreementRegistry", address(agreement));
        registry.registerModule("VaultManager", address(vault));
        registry.registerModule("WorkUnitManager", address(work));
        registry.registerModule("ReputationRegistry", address(rep));
        registry.registerModule("FeeManager", address(fee));
        registry.registerModule("DisputeManager", address(dispute));
        registry.registerModule("PermissionManager", address(perm));

        // --- optional: allowlist a payment token ---
        address paymentToken = vm.envOr("PAYMENT_TOKEN", address(0));
        if (paymentToken != address(0)) vault.setTokenAllowed(paymentToken, true);

        vm.stopBroadcast();

        console2.log("AgreementRegistry:", address(agreement));
        console2.log("VaultManager:", address(vault));
        console2.log("Registry:", address(registry));
    }
}
