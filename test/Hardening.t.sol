// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base} from "./Base.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {WorkUnitManager} from "../src/WorkUnitManager.sol";
import {JobRegistry} from "../src/JobRegistry.sol";
import {DisputeManager} from "../src/extensions/DisputeManager.sol";
import {AgreementStatus, JobStatus, WorkUnitStatus, DisputeOutcome} from "../src/libraries/Types.sol";

/// @notice Regression tests for the audit fixes (M1 work-unit cancel, M2
/// redispute cooldown, M3 fee snapshot, L4 job-on-terminate) plus adversarial
/// probes around each new path.
contract HardeningTest is Base {
    function setUp() public {
        deployProtocol();
    }

    // ============ M1: work-unit cancel / liveness trap ============

    function test_Cancel_RevertsBeforeWindow() public {
        (, uint256 wu) = _fundedUnit(AMOUNT); // CREATED, freelancer never starts
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.ApprovalWindowNotElapsed.selector);
        agreement.cancelWorkUnit(wu);
    }

    /// @dev The core M1 fix: a stalled unit no longer permanently locks refund.
    function test_Cancel_FreesLockedAgreement_AndRefunds() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);

        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);

        _assert(work.getWorkUnit(wu).status == WorkUnitStatus.CANCELLED, "not cancelled");

        // Outstanding cleared -> agreement can complete and refund the escrow.
        vm.prank(employer);
        agreement.completeAgreement(aid);
        vm.prank(employer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(employer) == 100 * AMOUNT, "employer not made whole");

        VaultManager.Vault memory v = vault.getVault(agreement.getAgreement(aid).vaultId);
        _assert(v.deposited == v.released + v.refunded, "accounting broken after cancel");
    }

    function test_Cancel_InProgress_AfterWindow() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        agreement.startWork(wu); // IN_PROGRESS
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        vm.prank(employer);
        agreement.completeAgreement(aid);
        vm.prank(employer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(employer) == 100 * AMOUNT, "refund after in-progress cancel");
    }

    /// @dev SUBMITTED must NOT be cancellable — that's the freelancer's
    /// claimApproval path; otherwise an employer could cancel submitted work.
    function test_Cancel_RejectsSubmitted() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, CID);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.NotCancellable.selector);
        agreement.cancelWorkUnit(wu);
    }

    /// @dev REVISION_REQUESTED uses the submission clock, and resubmitting the
    /// work moves the unit out of cancellable range entirely.
    function test_Cancel_RevisionRequested_UsesSubmitClock() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, CID); // submittedAt = now
        vm.prank(employer);
        agreement.requestRevision(wu); // REVISION_REQUESTED

        // Still inside the window measured from the submission: not yet.
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.ApprovalWindowNotElapsed.selector);
        agreement.cancelWorkUnit(wu);

        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        _assert(work.getWorkUnit(wu).status == WorkUnitStatus.CANCELLED, "revision cancel failed");
    }

    function test_Cancel_OnlyEmployer() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(freelancer);
        vm.expectRevert(AgreementRegistry.NotEmployer.selector);
        agreement.cancelWorkUnit(wu);
    }

    function test_Cancel_BlockedDuringDispute() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(employer);
        dispute.openDispute(aid, CID);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.NotActive.selector);
        agreement.cancelWorkUnit(wu);
    }

    /// @dev Cancel frees the allocation so the employer can re-issue the unit.
    function test_Cancel_RestoresAllocation() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT); // allocation == AMOUNT (full)
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);

        vm.prank(employer);
        uint256 wu2 = agreement.addWorkUnit(aid, 2, AMOUNT, CID); // would overflow allocation if not freed
        _assert(wu2 != 0, "allocation not restored");
        _assert(agreement.getAgreement(aid).allocated == AMOUNT, "allocated mismatch");
    }

    function test_Cancel_CannotCancelTwice() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.NotCancellable.selector);
        agreement.cancelWorkUnit(wu);
    }

    /// @dev A cancelled unit is dead: no further lifecycle action can revive it.
    function test_Cancel_ThenStartWorkReverts() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        vm.prank(freelancer);
        vm.expectRevert(WorkUnitManager.InvalidState.selector);
        agreement.startWork(wu);
    }

    /// @dev Cancel one unit, settle another — releases stay bounded by funding.
    function test_Cancel_PartialThenSettleRemainder() public {
        uint256 aid = _newAgreement(AMOUNT);
        vm.prank(employer);
        agreement.fundVault(aid, AMOUNT);
        vm.prank(employer);
        uint256 wuA = agreement.addWorkUnit(aid, 1, AMOUNT / 2, CID);
        vm.prank(employer);
        uint256 wuB = agreement.addWorkUnit(aid, 2, AMOUNT / 2, CID);

        // Cancel A after window; settle B normally.
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wuA);
        _runToApproved(wuB);
        agreement.settleWorkUnit(wuB);

        vm.prank(employer);
        agreement.completeAgreement(aid);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        vm.prank(employer);
        vault.withdraw(address(token));

        // freelancer got half; employer refunded the other half.
        _assert(token.balanceOf(freelancer) == AMOUNT / 2, "freelancer half wrong");
        _assert(token.balanceOf(employer) == 100 * AMOUNT - AMOUNT / 2, "employer refund wrong");
        VaultManager.Vault memory v = vault.getVault(agreement.getAgreement(aid).vaultId);
        _assert(v.deposited == v.released + v.refunded, "solvency after partial cancel");
    }

    // ============ L4: terminate releases the job ============

    function test_Terminate_MarksJobCancelled() public {
        uint256 aid = _newAgreement(AMOUNT); // job FILLED, no work units
        uint256 jobId = agreement.getAgreement(aid).jobId;
        vm.prank(employer);
        agreement.terminateAgreement(aid);
        _assert(jobs.getJob(jobId).status == JobStatus.CANCELLED, "job not released from FILLED");
    }

    // ============ M2: redispute cooldown ============

    function test_Redispute_CooldownBlocksThenAllows() public {
        (uint256 aid,) = _fundedUnit(AMOUNT);
        vm.prank(employer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.dismissDispute(did, CID); // ACTIVE again, cooldown armed

        vm.prank(employer);
        vm.expectRevert(DisputeManager.RedisputeCooldown.selector);
        dispute.openDispute(aid, CID);

        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(employer);
        uint256 did2 = dispute.openDispute(aid, CID);
        _assert(did2 != 0 && did2 != did, "redispute after cooldown failed");
    }

    // ============ M3: fee snapshot immunity ============

    /// @dev Fee is captured at vault creation; a later increase can't retro-skim.
    function test_Fee_SnapshotIgnoresLaterIncrease() public {
        fee.setFeeConfig(address(token), 250, treasury, true); // 2.5% at creation
        (, uint256 wu) = _fundedUnit(AMOUNT); // vault snapshots 2.5%

        fee.setFeeConfig(address(token), 1000, treasury, true); // owner bumps to 10%

        _runToApproved(wu);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        vm.prank(treasury);
        vault.withdraw(address(token));

        uint256 expFee = (AMOUNT * 250) / 10_000; // the SNAPSHOT rate, not 10%
        _assert(token.balanceOf(freelancer) == AMOUNT - expFee, "snapshot fee not honored");
        _assert(token.balanceOf(treasury) == expFee, "treasury skimmed extra");
    }

    /// @dev Enabling a fee after the vault exists doesn't apply to live escrow.
    function test_Fee_SnapshotIgnoresLaterEnable() public {
        (, uint256 wu) = _fundedUnit(AMOUNT); // no fee config -> snapshot 0
        fee.setFeeConfig(address(token), 1000, treasury, true); // enable after the fact

        _runToApproved(wu);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "fee wrongly applied to old vault");
    }

    /// @dev The snapshot must also govern DISPUTE payouts, not just normal
    /// settlement — otherwise the owner could front-run a resolution to skim.
    function test_Fee_DisputePayoutUsesSnapshot() public {
        fee.setFeeConfig(address(token), 250, treasury, true);
        (uint256 aid,) = _fundedUnit(AMOUNT); // vault snapshots 2.5%
        fee.setFeeConfig(address(token), 1000, treasury, true); // bump after the fact

        vm.prank(freelancer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.beginReview(did);
        dispute.resolveDispute(did, DisputeOutcome.FREELANCER_PREVAILS, AMOUNT, 0, CID);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        vm.prank(treasury);
        vault.withdraw(address(token));

        uint256 expFee = (AMOUNT * 250) / 10_000;
        _assert(token.balanceOf(freelancer) == AMOUNT - expFee, "dispute used live fee, not snapshot");
        _assert(token.balanceOf(treasury) == expFee, "dispute payout skimmed extra");
    }

    // ============ deep accounting probes ============

    /// @dev A SETTLED unit's allocation stays reserved forever — it can't be
    /// cancelled or re-issued — so the freelancer can never be paid more than the
    /// agreed total even when the vault is overfunded.
    function test_SettledAllocation_CannotBeRecycledToOverpay() public {
        uint256 aid = _newAgreement(AMOUNT); // totalAmount == AMOUNT
        vm.prank(employer);
        agreement.fundVault(aid, 2 * AMOUNT); // OVERFUND 2x
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, 1, AMOUNT, CID); // allocation full
        _runToApproved(wu);
        agreement.settleWorkUnit(wu); // freelancer paid AMOUNT

        // Allocation remains reserved by the settled unit: no new unit fits.
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.AllocationExceedsTotal.selector);
        agreement.addWorkUnit(aid, 2, 1, CID);

        // And a settled unit can't be cancelled to free its slot.
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.NotCancellable.selector);
        agreement.cancelWorkUnit(wu);

        // Excess funding returns to the employer; freelancer capped at AMOUNT.
        vm.prank(employer);
        agreement.completeAgreement(aid);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        vm.prank(employer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "freelancer overpaid past total");
        _assert(token.balanceOf(employer) == 100 * AMOUNT - AMOUNT, "excess not refunded");
    }

    /// @dev After a dispute resolution, a unit left in APPROVED cannot be settled
    /// for a second payout — the agreement is RESOLVED, not ACTIVE.
    function test_PostResolution_LeftoverApprovedCannotDoublePay() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu); // APPROVED, NOT settled; available still == AMOUNT

        vm.prank(employer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.beginReview(did);
        dispute.resolveDispute(did, DisputeOutcome.EMPLOYER_PREVAILS, 0, AMOUNT, CID); // all to employer

        vm.expectRevert(AgreementRegistry.NotActive.selector);
        agreement.settleWorkUnit(wu); // the approved unit is now dead

        vm.prank(employer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(employer) == 100 * AMOUNT, "employer not fully refunded");
        _assert(vault.claimable(freelancer, address(token)) == 0, "freelancer double-credited");
    }

    /// @dev D1 FIX: the §7 approval clock is paused across a dispute. Time spent
    /// DISPUTED no longer burns the window — on dismissal both parties get a
    /// fresh full window measured from the dismissal, so claimApproval can't fire
    /// the instant a dispute clears.
    function test_ApprovalClock_PausedAcrossDispute() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, CID); // submittedAt = now

        vm.prank(employer);
        uint256 did = dispute.openDispute(aid, CID); // DISPUTED

        vm.warp(block.timestamp + 14 days + 1); // would have elapsed pre-fix
        dispute.dismissDispute(did, CID); // back to ACTIVE; clock resumes here

        // No instant force-approval: the window restarts from the dismissal.
        vm.expectRevert(AgreementRegistry.ApprovalWindowNotElapsed.selector);
        agreement.claimApproval(wu);

        // Employer still has their revision window.
        vm.prank(employer);
        agreement.requestRevision(wu);
        _assert(work.getWorkUnit(wu).status == WorkUnitStatus.REVISION_REQUESTED, "lost revision window");
    }

    /// @dev Symmetric to the above for the employer's cancel clock: a dispute
    /// can't shorten the freelancer's response window before a stale-unit cancel.
    function test_CancelClock_PausedAcrossDispute() public {
        (uint256 aid, uint256 wu) = _fundedUnit(AMOUNT); // CREATED unit
        vm.prank(freelancer);
        agreement.startWork(wu); // IN_PROGRESS

        vm.prank(freelancer);
        uint256 did = dispute.openDispute(aid, CID);
        vm.warp(block.timestamp + 14 days + 1);
        dispute.dismissDispute(did, CID); // clock resumes here

        // Cancel window restarts from dismissal — not yet cancellable.
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.ApprovalWindowNotElapsed.selector);
        agreement.cancelWorkUnit(wu);

        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu); // now allowed
        _assert(work.getWorkUnit(wu).status == WorkUnitStatus.CANCELLED, "cancel after fresh window failed");
    }

    // ============ D5: excess sweep ============

    /// @dev Donated tokens (no vault accounts for them) are sweepable; escrow and
    /// pending claimables are never touchable because `owed` reserves them.
    function test_Sweep_OnlyDonatedExcess() public {
        (, uint256 wu) = _fundedUnit(AMOUNT); // AMOUNT now escrowed (owed == AMOUNT)

        // Nothing to sweep while every token is reserved.
        vm.expectRevert(VaultManager.NothingToSweep.selector);
        vault.sweep(address(token), treasury);

        // Someone donates straight to the vault contract.
        token.mint(address(vault), 5e18);
        _assert(vault.owed(address(token)) == AMOUNT, "owed shifted by donation");

        vault.sweep(address(token), treasury); // owner = this
        _assert(token.balanceOf(treasury) == 5e18, "donation not swept");

        // Escrow still intact: settle + withdraw pays the freelancer in full.
        _runToApproved(wu);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "sweep ate escrow");
    }

    function test_Sweep_CannotTouchEscrowOrClaimables() public {
        (, uint256 wu) = _fundedUnit(AMOUNT);
        _runToApproved(wu);
        agreement.settleWorkUnit(wu); // AMOUNT now sits in freelancer's claimable

        // owed still equals the full AMOUNT (escrow -> claimable, net zero).
        _assert(vault.owed(address(token)) == AMOUNT, "owed drifted on settle");
        vm.expectRevert(VaultManager.NothingToSweep.selector);
        vault.sweep(address(token), treasury);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "claimable not honored");
        _assert(vault.owed(address(token)) == 0, "owed not cleared on withdraw");
    }
}
