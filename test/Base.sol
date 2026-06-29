// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
import {SettlementModel} from "../src/libraries/Types.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Minimal Foundry cheatcode interface — avoids a forge-std dependency.
interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function label(address, string calldata) external;
}

/// @dev Full protocol deployment + wiring shared by the test suites.
contract Base {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    ProfileRegistry profiles;
    JobRegistry jobs;
    BidRegistry bidsC;
    VaultManager vault;
    WorkUnitManager work;
    ReputationRegistry rep;
    AgreementRegistry agreement;
    FeeManager fee;
    DisputeManager dispute;
    PermissionManager perm;
    MockERC20 token;

    address employer = address(0xE);
    address freelancer = address(0xF);
    address treasury = address(0x7);
    address delegate = address(0xD);

    uint256 empProfile;
    uint256 freeProfile;

    uint256 constant AMOUNT = 1000e18;
    bytes32 constant CID = bytes32(uint256(1));

    function deployProtocol() internal {
        address admin = address(this);
        profiles = new ProfileRegistry();
        jobs = new JobRegistry(admin, address(profiles));
        bidsC = new BidRegistry(admin, address(profiles), address(jobs));
        vault = new VaultManager(admin);
        work = new WorkUnitManager(admin);
        rep = new ReputationRegistry(admin);
        agreement = new AgreementRegistry(
            admin, address(profiles), address(jobs), address(bidsC), address(vault), address(work), address(rep)
        );

        // Core wiring (set-once trusted sibling, §3).
        jobs.wireAgreementRegistry(address(agreement));
        bidsC.wireAgreementRegistry(address(agreement));
        vault.wireAgreementRegistry(address(agreement));
        work.wireAgreementRegistry(address(agreement));
        rep.wireAgreementRegistry(address(agreement));

        // Extensions.
        fee = new FeeManager(admin);
        perm = new PermissionManager(address(profiles));
        dispute = new DisputeManager(admin, address(agreement), address(profiles)); // admin = arbitrator

        vault.setFeeManager(address(fee));
        agreement.setDisputeManager(address(dispute));
        agreement.setPermissionManager(address(perm));
        jobs.setPermissionManager(address(perm));
        bidsC.setPermissionManager(address(perm));

        token = new MockERC20();
        vault.setTokenAllowed(address(token), true);

        // Actors.
        vm.prank(employer);
        empProfile = profiles.createProfile(CID);
        vm.prank(freelancer);
        freeProfile = profiles.createProfile(CID);

        token.mint(employer, 100 * AMOUNT);
        vm.prank(employer);
        token.approve(address(vault), type(uint256).max);
    }

    // ---- helpers ----

    function _newAgreement(uint256 amount) internal returns (uint256 agreementId) {
        vm.prank(employer);
        // MILESTONE by default so helpers can split into partial work units;
        // FIXED-specific behavior is exercised in Features.t.sol.
        uint256 jobId = jobs.createJob(empProfile, address(token), amount, SettlementModel.MILESTONE, CID);
        vm.prank(freelancer);
        uint256 bidId = bidsC.submitBid(jobId, freeProfile, amount, 0, CID);
        vm.prank(employer);
        agreementId = agreement.createAgreement(jobId, bidId);
    }

    /// @dev Agreement created, fully funded, with one work unit covering it.
    function _fundedUnit(uint256 amount) internal returns (uint256 aid, uint256 wu) {
        aid = _newAgreement(amount);
        vm.prank(employer);
        agreement.fundVault(aid, amount);
        vm.prank(employer);
        wu = agreement.addWorkUnit(aid, 1, amount, CID);
    }

    function _runToApproved(uint256 wu) internal {
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, CID);
        vm.prank(employer);
        agreement.approveWork(wu);
    }

    function _assert(bool cond, string memory what) internal pure {
        require(cond, what);
    }
}
