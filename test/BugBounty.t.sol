// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base} from "./Base.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {SettlementModel} from "../src/libraries/Types.sol";
import {ReentrantToken} from "./mocks/ReentrantToken.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Adversarial suite modeling top-paid Immunefi bug classes against the
/// escrow: reentrancy (single- and cross-function), callback-token allowlist
/// mistakes, and accounting drift under reentry.
contract BugBountyTest is Base {
    ReentrantToken rt;

    function setUp() public {
        deployProtocol();
        rt = new ReentrantToken();
        vault.setTokenAllowed(address(rt), true); // governance allowlists a callback token (mistake)
    }

    /// @dev Run an agreement denominated in the reentrant token up to a settled,
    /// withdrawable claimable for the freelancer. Attack stays disarmed here.
    function _settledReentrantClaim(uint256 amount) internal returns (uint256 aid, uint256 wu) {
        rt.mint(employer, amount);
        vm.prank(employer);
        rt.approve(address(vault), type(uint256).max);

        vm.prank(employer);
        uint256 jobId = jobs.createJob(empProfile, address(rt), amount, SettlementModel.FIXED, CID);
        vm.prank(freelancer);
        uint256 bidId = bidsC.submitBid(jobId, freeProfile, amount, 0, CID);
        vm.prank(employer);
        aid = agreement.createAgreement(jobId, bidId);
        vm.prank(employer);
        agreement.fundVault(aid, amount);
        vm.prank(employer);
        wu = agreement.addWorkUnit(aid, 1, amount, CID);
        _runToApproved(wu);
        agreement.settleWorkUnit(wu); // claimable[freelancer][rt] = amount
    }

    // ============ classic reentrancy: withdraw ============

    /// @dev A callback token cannot reenter withdraw to double-spend. The guard
    /// fires inside the reentry and rolls the whole tx back — no leakage.
    function test_Reentrancy_WithdrawCannotDoubleSpend() public {
        _settledReentrantClaim(AMOUNT);
        rt.setAttack(address(vault), 1); // reenter withdraw on transfer

        vm.prank(freelancer);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vault.withdraw(address(rt));

        // Nothing moved: claim intact, vault still holds the escrow.
        _assert(vault.claimable(freelancer, address(rt)) == AMOUNT, "claim was consumed");
        _assert(rt.balanceOf(freelancer) == 0, "freelancer leaked tokens");
        _assert(rt.balanceOf(address(vault)) == AMOUNT, "vault drained");
        _assert(vault.owed(address(rt)) == AMOUNT, "owed drifted");

        // Disarmed, the legitimate withdraw pays exactly once.
        rt.setAttack(address(0), 0);
        vm.prank(freelancer);
        vault.withdraw(address(rt));
        _assert(rt.balanceOf(freelancer) == AMOUNT, "honest withdraw broken");
        _assert(vault.owed(address(rt)) == 0, "owed not cleared");
    }

    // ============ cross-function reentrancy: settle during withdraw ============

    /// @dev releasePayment is NOT nonReentrant, so a settle CAN execute inside a
    /// withdraw transfer. Prove it stays harmless: no double-spend, and the
    /// `owed` accumulator never drifts from real obligations.
    function test_CrossFn_SettleDuringWithdraw_NoDrift() public {
        uint256 amount = AMOUNT;
        rt.mint(employer, 2 * amount);
        vm.prank(employer);
        rt.approve(address(vault), type(uint256).max);

        vm.prank(employer);
        uint256 jobId = jobs.createJob(empProfile, address(rt), 2 * amount, SettlementModel.FIXED, CID);
        vm.prank(freelancer);
        uint256 bidId = bidsC.submitBid(jobId, freeProfile, 2 * amount, 0, CID);
        vm.prank(employer);
        uint256 aid = agreement.createAgreement(jobId, bidId);
        vm.prank(employer);
        agreement.fundVault(aid, 2 * amount);

        vm.prank(employer);
        uint256 wu1 = agreement.addWorkUnit(aid, 1, amount, CID);
        vm.prank(employer);
        uint256 wu2 = agreement.addWorkUnit(aid, 2, amount, CID);
        _runToApproved(wu1);
        _runToApproved(wu2);

        agreement.settleWorkUnit(wu1); // claimable[freelancer][rt] = amount; available = amount

        // Arm: withdrawing unit 1 reenters settle of unit 2 mid-transfer.
        rt.setSettleReenter(address(vault), address(agreement), wu2);

        uint256 vaultId = agreement.getAgreement(aid).vaultId;

        vm.prank(freelancer);
        vault.withdraw(address(rt)); // succeeds; reentry settles wu2 harmlessly

        // First payout landed; second is now a fresh claimable from the reentry.
        _assert(rt.balanceOf(freelancer) == amount, "first payout wrong");
        _assert(vault.claimable(freelancer, address(rt)) == amount, "reentry claim wrong");

        // owed accumulator must still match true obligations exactly.
        uint256 obligations = vault.claimable(freelancer, address(rt)) + vault.available(vaultId);
        _assert(vault.owed(address(rt)) == obligations, "owed drifted under cross-fn reentry");
        _assert(rt.balanceOf(address(vault)) == obligations, "balance != obligations under reentry");

        // Second withdraw pays the rest; freelancer total == 2*amount, never more.
        rt.setAttack(address(0), 0);
        vm.prank(freelancer);
        vault.withdraw(address(rt));
        _assert(rt.balanceOf(freelancer) == 2 * amount, "freelancer double-paid or short");
        _assert(vault.owed(address(rt)) == 0, "owed not cleared");
        _assert(rt.balanceOf(address(vault)) == 0, "tokens stranded in vault");
    }
}
