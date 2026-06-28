// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base} from "./Base.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {WorkUnitManager} from "../src/WorkUnitManager.sol";
import {JobRegistry} from "../src/JobRegistry.sol";
import {FeeManager} from "../src/extensions/FeeManager.sol";
import {DisputeManager} from "../src/extensions/DisputeManager.sol";
import {Wired} from "../src/utils/Wired.sol";
import {Capabilities} from "../src/libraries/Capabilities.sol";
import {AgreementStatus, JobStatus, DisputeOutcome, SettlementModel} from "../src/libraries/Types.sol";

contract ProtocolTest is Base {
    function setUp() public {
        deployProtocol();
    }

    // ---------- happy path + accounting ----------

    function test_HappyPath_NoFee() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "freelancer not paid");

        vm.prank(employer);
        agreement.completeAgreement(aid);

        AgreementRegistry.Agreement memory ag = agreement.getAgreement(aid);
        _assert(ag.status == AgreementStatus.COMPLETED, "not completed");
        _assert(jobs.getJob(ag.jobId).status == JobStatus.COMPLETED, "job not completed");

        VaultManager.Vault memory v = vault.getVault(ag.vaultId);
        _assert(v.deposited == v.released + v.refunded, "accounting broken");
        _assert(rep.completedAsFreelancer(freeProfile) == 1, "reputation missing");
    }

    // ---------- fees ----------

    function test_Fee_SplitsToTreasury() public {
        fee.setFeeConfig(address(token), 250, treasury, true); // 2.5%
        (, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);

        uint256 expFee = (AMOUNT * 250) / 10_000;
        vm.prank(freelancer);
        vault.withdraw(address(token));
        vm.prank(treasury);
        vault.withdraw(address(token));

        _assert(token.balanceOf(freelancer) == AMOUNT - expFee, "wrong net");
        _assert(token.balanceOf(treasury) == expFee, "wrong fee");
    }

    function test_Fee_RejectsAboveMax() public {
        vm.expectRevert(FeeManager.InvalidFeeRate.selector);
        fee.setFeeConfig(address(token), 1001, treasury, true);
    }

    // ---------- hardening guards ----------

    function test_StartWork_RevertsWhenUnderfunded() public {
        uint256 aid = _newAgreement(AMOUNT);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, 1, AMOUNT, CID); // no funding
        vm.prank(freelancer);
        vm.expectRevert(AgreementRegistry.Underfunded.selector); // §4
        agreement.startWork(wu);
    }

    function test_AllocationBound_Reverts() public {
        uint256 aid = _newAgreement(AMOUNT);
        vm.prank(employer);
        agreement.addWorkUnit(aid, 1, AMOUNT, CID); // exhausts allocation
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.AllocationExceedsTotal.selector); // §5
        agreement.addWorkUnit(aid, 2, 1, CID);
    }

    function test_DoubleSettle_Reverts() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vm.expectRevert(WorkUnitManager.InvalidState.selector);
        agreement.settleWorkUnit(wu);
    }

    function test_ClaimApproval_AfterWindow() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, CID);

        vm.warp(block.timestamp + 14 days + 1); // §7
        agreement.claimApproval(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "timeout settle failed");
    }

    function test_DirectVaultCall_Reverts() public {
        vm.expectRevert(Wired.NotAgreementRegistry.selector);
        vault.releasePayment(1, freelancer, 1); // not the AgreementRegistry
    }

    // ---------- disputes ----------

    function test_Dispute_LockBlocksSettle() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu);
        vm.prank(employer);
        dispute.openDispute(aid, CID);

        vm.prank(freelancer);
        vm.expectRevert(AgreementRegistry.NotActive.selector); // §6
        agreement.settleWorkUnit(wu);
    }

    function test_Dispute_ResolveSplit() public {
        (uint256 aid,) = _fundedUnit(AMOUNT); // funded; nothing settled
        vm.prank(freelancer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.beginReview(did);
        dispute.resolveDispute(did, DisputeOutcome.SPLIT, 600e18, 400e18, CID);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        vm.prank(employer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == 600e18, "freelancer split wrong");
        // employer was minted 100*AMOUNT and deposited AMOUNT; +400 refund back.
        _assert(token.balanceOf(employer) == 100 * AMOUNT - AMOUNT + 400e18, "employer refund wrong");

        AgreementRegistry.Agreement memory ag = agreement.getAgreement(aid);
        _assert(ag.status == AgreementStatus.RESOLVED, "not resolved");
    }

    function test_Dispute_Dismiss_ReturnsActive() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(employer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.dismissDispute(did, CID);

        // Back to ACTIVE: normal flow resumes.
        _runToApproved(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "post-dismiss settle failed");
    }

    function test_Dispute_OnlyParticipantOpens() public {
        (uint256 aid,) = _fundedUnit(AMOUNT);
        vm.prank(address(0x1234));
        vm.expectRevert(DisputeManager.NotParticipant.selector);
        dispute.openDispute(aid, CID);
    }

    // ---------- delegation ----------

    function test_Delegation_AllowsAndRevokes() public {
        vm.prank(employer);
        perm.grantPermission(empProfile, delegate, Capabilities.CREATE_JOB, 0);

        vm.prank(delegate);
        uint256 jobId = jobs.createJob(empProfile, address(token), AMOUNT, SettlementModel.FIXED, CID);
        _assert(jobId != 0, "delegate could not create job");

        // Delegate lacks CANCEL_JOB.
        vm.prank(delegate);
        vm.expectRevert(JobRegistry.NotProfileOwner.selector);
        jobs.cancelJob(jobId);

        // Revoke kills the grant immediately.
        vm.prank(employer);
        perm.revokePermission(empProfile, delegate);
        vm.prank(delegate);
        vm.expectRevert(JobRegistry.NotProfileOwner.selector);
        jobs.createJob(empProfile, address(token), AMOUNT, SettlementModel.FIXED, CID);
    }

    // ---------- circuit breaker ----------

    function test_Pause_BlocksNewCommitmentsNotWithdraw() public {
        // Settle one agreement so the freelancer has a pending claimable.
        (, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);

        uint256 aid2 = _newAgreement(AMOUNT); // active, unfunded, created before pause

        agreement.setPaused(true); // guardian = admin = this

        // Withdrawals are never pausable.
        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "withdraw blocked by pause");

        // New funding is blocked.
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.Paused.selector);
        agreement.fundVault(aid2, AMOUNT);
    }

    // ---------- fuzz ----------

    function testFuzz_Fee(uint256 amount, uint16 bps) public {
        amount = amount % 1e30;
        bps = uint16(bps % 1001); // <= MAX_FEE_BPS
        fee.setFeeConfig(address(token), bps, treasury, true);
        (uint256 f, uint256 n, address t) = fee.quote(address(token), amount);
        _assert(f + n == amount, "fee+net != amount");
        _assert(f <= amount, "fee > amount");
        if (f > 0) _assert(t == treasury, "missing treasury");
    }

    function testFuzz_VaultAccounting(uint256 amount, uint256 unit) public {
        amount = 1 + (amount % (10 * AMOUNT)); // within the employer's minted balance
        unit = 1 + (unit % amount); // 1..amount
        uint256 aid = _newAgreement(amount);
        vm.prank(employer);
        agreement.fundVault(aid, amount);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, 1, unit, CID);
        _runToApproved(wu);
        vm.prank(freelancer);
        agreement.settleWorkUnit(wu);

        AgreementRegistry.Agreement memory ag = agreement.getAgreement(aid);
        VaultManager.Vault memory v = vault.getVault(ag.vaultId);
        _assert(v.deposited == amount, "deposit mismatch");
        _assert(v.released == unit, "release mismatch");
        _assert(v.released <= v.deposited, "released > deposited");
        _assert(vault.available(ag.vaultId) == amount - unit, "available mismatch");
    }
}
