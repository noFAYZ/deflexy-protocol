// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base} from "./Base.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {DisputeManager} from "../src/extensions/DisputeManager.sol";
import {SettlementModel, DisputeOutcome} from "../src/libraries/Types.sol";

/// @notice Tests for the newly-meaningful SettlementModel (FIXED vs MILESTONE)
/// and dispute-outcome reputation.
contract FeaturesTest is Base {
    function setUp() public {
        deployProtocol();
    }

    // helper: FIXED agreement of `amount`
    function _fixedAgreement(uint256 amount) internal returns (uint256 aid) {
        vm.prank(employer);
        uint256 jobId = jobs.createJob(empProfile, address(token), amount, SettlementModel.FIXED, CID);
        vm.prank(freelancer);
        uint256 bidId = bidsC.submitBid(jobId, freeProfile, amount, 0, CID);
        vm.prank(employer);
        aid = agreement.createAgreement(jobId, bidId);
        vm.prank(employer);
        agreement.fundVault(aid, amount);
    }

    // ============ FIXED model ============

    function test_Fixed_RejectsPartialUnit() public {
        uint256 aid = _fixedAgreement(AMOUNT);
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.InvalidFixedAmount.selector);
        agreement.addWorkUnit(aid, 1, AMOUNT - 1, CID); // not the full amount
    }

    function test_Fixed_AcceptsSingleFullUnit_AndSettles() public {
        uint256 aid = _fixedAgreement(AMOUNT);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, 1, AMOUNT, CID);
        _runToApproved(wu);
        agreement.settleWorkUnit(wu);
        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "fixed full unit not paid");
    }

    /// @dev Once the single full unit exists, no second unit can be added.
    function test_Fixed_RejectsSecondUnit() public {
        uint256 aid = _fixedAgreement(AMOUNT);
        vm.prank(employer);
        agreement.addWorkUnit(aid, 1, AMOUNT, CID); // allocation now full
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.InvalidFixedAmount.selector); // amount != total fires first
        agreement.addWorkUnit(aid, 2, 1, CID);
    }

    /// @dev After cancelling the unit the slot frees and a fresh full unit fits.
    function test_Fixed_CancelThenReissue() public {
        uint256 aid = _fixedAgreement(AMOUNT);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, 1, AMOUNT, CID);
        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        vm.prank(employer);
        uint256 wu2 = agreement.addWorkUnit(aid, 2, AMOUNT, CID);
        _assert(wu2 != 0, "fixed re-issue failed");
    }

    // ============ MILESTONE model ============

    /// @dev MILESTONE splits into partial units summing to the total.
    function test_Milestone_AllowsPartialUnits() public {
        uint256 aid = _newAgreement(AMOUNT); // MILESTONE per Base helper
        vm.prank(employer);
        agreement.fundVault(aid, AMOUNT);
        vm.prank(employer);
        uint256 wuA = agreement.addWorkUnit(aid, 1, AMOUNT / 4, CID);
        vm.prank(employer);
        uint256 wuB = agreement.addWorkUnit(aid, 2, (AMOUNT * 3) / 4, CID);

        _runToApproved(wuA);
        agreement.settleWorkUnit(wuA);
        _runToApproved(wuB);
        agreement.settleWorkUnit(wuB);

        vm.prank(freelancer);
        vault.withdraw(address(token));
        _assert(token.balanceOf(freelancer) == AMOUNT, "milestone sum mispaid");
    }

    function test_Milestone_StillCappedAtTotal() public {
        uint256 aid = _newAgreement(AMOUNT);
        vm.prank(employer);
        agreement.fundVault(aid, AMOUNT);
        vm.prank(employer);
        agreement.addWorkUnit(aid, 1, AMOUNT, CID); // exhausts allocation
        vm.prank(employer);
        vm.expectRevert(AgreementRegistry.AllocationExceedsTotal.selector);
        agreement.addWorkUnit(aid, 2, 1, CID);
    }

    // ============ dispute outcomes -> reputation ============

    function test_DisputeRep_FreelancerLossRecorded() public {
        (uint256 aid,) = _fundedUnit(AMOUNT);
        vm.prank(employer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.beginReview(did);
        dispute.resolveDispute(did, DisputeOutcome.EMPLOYER_PREVAILS, 0, AMOUNT, CID);

        _assert(rep.disputesAsFreelancer(freeProfile) == 1, "freelancer dispute not counted");
        _assert(rep.disputesLostAsFreelancer(freeProfile) == 1, "freelancer loss not counted");
        _assert(rep.disputesAsEmployer(empProfile) == 1, "employer dispute not counted");
        _assert(rep.disputesLostAsEmployer(empProfile) == 0, "employer wrongly marked loser");
    }

    function test_DisputeRep_EmployerLossRecorded() public {
        (uint256 aid,) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.beginReview(did);
        dispute.resolveDispute(did, DisputeOutcome.FREELANCER_PREVAILS, AMOUNT, 0, CID);

        _assert(rep.disputesLostAsEmployer(empProfile) == 1, "employer loss not counted");
        _assert(rep.disputesLostAsFreelancer(freeProfile) == 0, "freelancer wrongly marked loser");
    }

    /// @dev A SPLIT counts as a dispute for both, a loss for neither.
    function test_DisputeRep_SplitIsNoLoss() public {
        (uint256 aid,) = _fundedUnit(AMOUNT);
        vm.prank(freelancer);
        uint256 did = dispute.openDispute(aid, CID);
        dispute.beginReview(did);
        dispute.resolveDispute(did, DisputeOutcome.SPLIT, 600e18, 400e18, CID);

        _assert(rep.disputesAsFreelancer(freeProfile) == 1, "split: freelancer count");
        _assert(rep.disputesAsEmployer(empProfile) == 1, "split: employer count");
        _assert(rep.disputesLostAsFreelancer(freeProfile) == 0, "split: freelancer loss");
        _assert(rep.disputesLostAsEmployer(empProfile) == 0, "split: employer loss");
    }
}
