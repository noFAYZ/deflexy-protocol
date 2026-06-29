// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base, Vm} from "./Base.sol";
import {AgreementRegistry} from "../src/AgreementRegistry.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {JobRegistry} from "../src/JobRegistry.sol";
import {BidRegistry} from "../src/BidRegistry.sol";
import {WorkUnitManager} from "../src/WorkUnitManager.sol";
import {FeeManager} from "../src/extensions/FeeManager.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {SettlementModel} from "../src/libraries/Types.sol";

/// @dev Drives a single agreement with bounded, always-valid randomized
/// operations so the fuzzer explores real state instead of bouncing off reverts.
contract Handler {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    AgreementRegistry public agreement;
    VaultManager public vault;
    MockERC20 public token;
    FeeManager public fee;
    address public employer;
    address public freelancer;
    address public treasuryAddr;

    uint256 public aid;
    uint256 public vaultId;
    uint256 public total;
    uint256 public allocated;
    uint64 public seq;

    constructor(
        AgreementRegistry _agreement,
        VaultManager _vault,
        MockERC20 _token,
        FeeManager _fee,
        address _employer,
        address _freelancer,
        address _treasury,
        uint256 _aid,
        uint256 _vaultId,
        uint256 _total
    ) {
        agreement = _agreement;
        vault = _vault;
        token = _token;
        fee = _fee;
        employer = _employer;
        freelancer = _freelancer;
        treasuryAddr = _treasury;
        aid = _aid;
        vaultId = _vaultId;
        total = _total;
    }

    function fund(uint256 amt) external {
        amt = 1 + (amt % (total));
        token.mint(employer, amt);
        vm.prank(employer);
        agreement.fundVault(aid, amt);
    }

    function settleUnit(uint256 amt) external {
        uint256 avail = vault.available(vaultId);
        uint256 rem = total - allocated;
        uint256 cap = avail < rem ? avail : rem;
        if (cap == 0) return;
        amt = 1 + (amt % cap);

        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, ++seq, amt, bytes32(0));
        allocated += amt;
        vm.prank(freelancer);
        agreement.startWork(wu);
        vm.prank(freelancer);
        agreement.submitWork(wu, bytes32(0));
        vm.prank(employer);
        agreement.approveWork(wu);
        agreement.settleWorkUnit(wu);
    }

    /// @dev Exercise the M1 cancel path: allocate a unit, let it go stale, and
    /// reclaim the allocation. Must never move tokens or break solvency.
    function addStaleAndCancel(uint256 amt) external {
        uint256 rem = total - allocated;
        if (rem == 0) return;
        amt = 1 + (amt % rem);
        vm.prank(employer);
        uint256 wu = agreement.addWorkUnit(aid, ++seq, amt, bytes32(0));
        allocated += amt;

        vm.warp(block.timestamp + 14 days + 1);
        vm.prank(employer);
        agreement.cancelWorkUnit(wu);
        allocated -= amt; // contract frees it; mirror locally
    }

    /// @dev Churn the fee policy. The vault snapshotted its fee at creation, so
    /// this must not change any in-flight settlement (M3) — solvency still holds.
    function churnFee(uint16 bps) external {
        bps = uint16(bps % 1001);
        fee.setFeeConfig(address(token), bps, treasuryAddr, true);
    }

    function withdrawFreelancer() external {
        if (vault.claimable(freelancer, address(token)) == 0) return;
        vm.prank(freelancer);
        vault.withdraw(address(token));
    }
}

/// @notice Solvency invariant: the VaultManager always physically holds exactly
/// what it owes — unreleased escrow plus every outstanding pull-claimable
/// balance. If this ever drifts, the protocol is insolvent.
contract InvariantTest is Base {
    Handler handler;

    function setUp() public {
        deployProtocol();

        uint256 total = 1_000 * AMOUNT;
        token.mint(employer, total); // headroom for the agreement

        // Non-zero fee at creation so the snapshot/fee path is under test; the
        // solvency sum below already accounts for the treasury's claimable.
        fee.setFeeConfig(address(token), 250, treasury, true);

        vm.prank(employer);
        uint256 jobId = jobs.createJob(empProfile, address(token), total, SettlementModel.FIXED, CID);
        vm.prank(freelancer);
        uint256 bidId = bidsC.submitBid(jobId, freeProfile, total, 0, CID);
        vm.prank(employer);
        uint256 aid = agreement.createAgreement(jobId, bidId);
        uint256 vaultId = agreement.getAgreement(aid).vaultId;

        handler = new Handler(agreement, vault, token, fee, employer, freelancer, treasury, aid, vaultId, total);
        fee.transferOwnership(address(handler)); // let churnFee mutate the policy
    }

    /// @dev Restrict the invariant fuzzer to the handler (no forge-std needed).
    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariant_solvency() public view {
        uint256 held = token.balanceOf(address(vault));
        uint256 owedSum = vault.available(handler.vaultId())
            + vault.claimable(freelancer, address(token)) + vault.claimable(employer, address(token))
            + vault.claimable(treasury, address(token));
        _assert(held == owedSum, "VaultManager insolvent");
        // The O(1) `owed` accumulator that backs sweep() must never drift from
        // the true obligation sum, or sweep could give away user funds.
        _assert(vault.owed(address(token)) == owedSum, "owed accumulator drift");
    }
}
