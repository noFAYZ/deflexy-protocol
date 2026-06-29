// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {JobRegistry} from "../src/JobRegistry.sol";
import {BidRegistry} from "../src/BidRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {SettlementModel} from "../src/libraries/Types.sol";

/// @notice Exercises the real deployment script (script/Deploy.s.sol). The whole
/// security model rests on the set-once wiring being correct, and nothing else
/// tests the script — a single mis-wire would ship silently. We run it with a
/// deterministic key (so the broadcaster is also the owner the onlyOwner wiring
/// calls expect), assert every link, then drive one end-to-end agreement.
contract DeployTest is Test {
    Deploy dep;
    address owner;

    function setUp() public {
        uint256 pk = 0xBEEF;
        owner = vm.addr(pk);
        vm.setEnv("PRIVATE_KEY", vm.toString(pk));
        dep = new Deploy();
        dep.run();
    }

    function test_TrustedSiblingWiring() public view {
        address ar = address(dep.agreement());
        assertEq(dep.jobs().agreementRegistry(), ar, "jobs not wired");
        assertEq(dep.bids().agreementRegistry(), ar, "bids not wired");
        assertEq(dep.vault().agreementRegistry(), ar, "vault not wired");
        assertEq(dep.work().agreementRegistry(), ar, "work not wired");
        assertEq(dep.rep().agreementRegistry(), ar, "rep not wired");
    }

    function test_ExtensionWiring() public view {
        assertEq(address(dep.vault().feeManager()), address(dep.fee()), "feeManager unset");
        assertEq(dep.agreement().disputeManager(), address(dep.dispute()), "disputeManager unset");
        assertEq(address(dep.agreement().permissionManager()), address(dep.perm()), "agreement perm unset");
        assertEq(address(dep.jobs().permissionManager()), address(dep.perm()), "jobs perm unset");
        assertEq(address(dep.bids().permissionManager()), address(dep.perm()), "bids perm unset");
    }

    function test_OwnershipAndGuardian() public view {
        assertEq(dep.jobs().owner(), owner, "jobs owner");
        assertEq(dep.vault().owner(), owner, "vault owner");
        assertEq(dep.agreement().owner(), owner, "agreement owner");
        assertEq(dep.agreement().guardian(), owner, "guardian defaults to owner");
        assertEq(dep.dispute().owner(), owner, "arbitrator is owner");
        assertEq(dep.fee().owner(), owner, "fee owner");
    }

    function test_RegistryDirectoryPopulated() public view {
        assertEq(dep.registry().getModule("AgreementRegistry"), address(dep.agreement()), "AR not registered");
        assertEq(dep.registry().getModule("VaultManager"), address(dep.vault()), "vault not registered");
        assertEq(dep.registry().getModule("DisputeManager"), address(dep.dispute()), "dispute not registered");
        assertEq(dep.registry().getModule("PermissionManager"), address(dep.perm()), "perm not registered");
    }

    /// @dev The wired system actually works end-to-end from a real deployment.
    function test_Smoke_EndToEndAgreement() public {
        ProfileRegistry profiles = dep.profiles();
        JobRegistry jobs = dep.jobs();
        BidRegistry bids = dep.bids();
        VaultManager vault = dep.vault();
        AgreementRegistry agreement = dep.agreement();

        MockERC20 token = new MockERC20();
        vm.prank(owner);
        vault.setTokenAllowed(address(token), true);

        address employer = address(0xE);
        address freelancer = address(0xF);
        uint256 amount = 1_000e18;

        vm.prank(employer);
        uint256 empProfile = profiles.createProfile(bytes32("e"));
        vm.prank(freelancer);
        uint256 freeProfile = profiles.createProfile(bytes32("f"));

        token.mint(employer, amount);
        vm.prank(employer);
        token.approve(address(vault), type(uint256).max);

        vm.prank(employer);
        uint256 jobId = jobs.createJob(empProfile, address(token), amount, SettlementModel.FIXED, bytes32("j"));
        vm.prank(freelancer);
        uint256 bidId = bids.submitBid(jobId, freeProfile, amount, 0, bytes32("b"));
        vm.prank(employer);
        uint256 aid = agreement.createAgreement(jobId, bidId);
        vm.prank(employer);
        agreement.fundVault(aid, amount);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, 1, amount, bytes32("w"));

        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, bytes32("s"));
        vm.prank(employer);
        agreement.approveWork(wu);
        agreement.settleWorkUnit(wu);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        assertEq(token.balanceOf(freelancer), amount, "deployed protocol did not settle");
    }
}
