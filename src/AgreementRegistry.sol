// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AgreementStatus, SettlementModel, JobStatus, BidStatus, WorkUnitStatus} from "./libraries/Types.sol";
import {Capabilities} from "./libraries/Capabilities.sol";
import {
    IProfileRegistry,
    IJobRegistry,
    IBidRegistry,
    IVaultManager,
    IWorkUnitManager,
    IReputationRegistry,
    IPermissionManager
} from "./interfaces/Interfaces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZeroAddress} from "./utils/Errors.sol";

/// @notice Protocol orchestrator and the single entry point for the work
/// lifecycle. It is the only address the dumb stores (Vault, WorkUnit,
/// Reputation) and the registries trust. All hardening checks live here:
///   §4  funding-before-work    (startWork requires available >= unit amount)
///   §5  allocation bound        (sum of work-unit amounts <= agreed total)
///   §6  dispute lock            (no settlement while DISPUTED)
///   §7  approval timeout        (claimApproval after APPROVAL_WINDOW)
/// Plus delegated permissions (optional PermissionManager) and a scoped
/// guardian circuit breaker that can halt *new* commitments but can never trap
/// in-flight funds (withdrawals/settlement/refunds are never pausable).
contract AgreementRegistry is Ownable {
    /// @dev Liveness window (§7). Deploy-time constant; change via redeploy.
    uint64 public constant APPROVAL_WINDOW = 14 days;

    IProfileRegistry public immutable profiles;
    IJobRegistry public immutable jobs;
    IBidRegistry public immutable bids;
    IVaultManager public immutable vault;
    IWorkUnitManager public immutable workUnits;
    IReputationRegistry public immutable reputation;

    /// @dev Optional delegation authority. Zero = owner-only authorization.
    IPermissionManager public permissionManager;
    /// @dev Dispute authority (the DisputeManager extension). Set once; the only
    /// address that may move funds while an agreement is DISPUTED (§6).
    address public disputeManager;
    /// @dev May trip the circuit breaker. Defaults to the owner.
    address public guardian;
    bool public paused;

    struct Agreement {
        uint256 jobId;
        uint256 bidId;
        uint256 employerProfileId;
        uint256 freelancerProfileId;
        address paymentToken;
        uint256 totalAmount; // accepted bid amount; immutable
        uint256 allocated; // sum of work-unit amounts created
        uint256 vaultId;
        SettlementModel model;
        AgreementStatus status;
        uint32 outstandingUnits; // created but not yet settled
        uint64 createdAt;
        uint64 completedAt;
        // §D1: timestamp the agreement last returned to ACTIVE from DISPUTED.
        // Liveness clocks (claimApproval / cancelWorkUnit) resume from here, so a
        // dispute can't silently burn a party's revision/response window.
        uint64 lastDisputeClearedAt;
    }

    uint256 public agreementCount;
    mapping(uint256 => Agreement) private _agreements;
    mapping(uint256 => uint256) public agreementOfJob; // jobId => agreementId (0 = none)

    event AgreementCreated(uint256 indexed agreementId, uint256 indexed jobId, uint256 indexed bidId);
    event AgreementActivated(uint256 indexed agreementId);
    event WorkUnitAdded(uint256 indexed agreementId, uint256 indexed workUnitId, uint256 amount);
    event WorkUnitSettled(uint256 indexed agreementId, uint256 indexed workUnitId, uint256 amount);
    event WorkUnitCancelled(uint256 indexed agreementId, uint256 indexed workUnitId, uint256 amount);
    event AgreementCompleted(uint256 indexed agreementId);
    event AgreementTerminated(uint256 indexed agreementId);
    event AgreementDisputed(uint256 indexed agreementId);
    event AgreementDisputeDismissed(uint256 indexed agreementId);
    event AgreementResolved(uint256 indexed agreementId, uint256 freelancerAmount, uint256 employerRefund);
    event PermissionManagerSet(address indexed permissionManager);
    event DisputeManagerSet(address indexed disputeManager);
    event GuardianSet(address indexed guardian);
    event PausedSet(bool paused);

    error AgreementNotFound();
    error AgreementExistsForJob();
    error NotEmployer();
    error NotFreelancer();
    error NotDisputeManager();
    error AlreadySet();
    error JobNotOpen();
    error BidNotForJob();
    error ProfileNotActive();
    error NotActive();
    error NotDisputed();
    error AllocationExceedsTotal();
    error Underfunded();
    error OutstandingUnits();
    error ApprovalWindowNotElapsed();
    error NotSubmitted();
    error NotCancellable();
    error InvalidDistribution();
    error Paused();
    error NotGuardian();

    constructor(
        address owner_,
        address profileRegistry,
        address jobRegistry,
        address bidRegistry,
        address vaultManager,
        address workUnitManager,
        address reputationRegistry
    ) Ownable(owner_) {
        profiles = IProfileRegistry(profileRegistry);
        jobs = IJobRegistry(jobRegistry);
        bids = IBidRegistry(bidRegistry);
        vault = IVaultManager(vaultManager);
        workUnits = IWorkUnitManager(workUnitManager);
        reputation = IReputationRegistry(reputationRegistry);
        guardian = owner_;
    }

    // --- wiring / governance ---

    function setPermissionManager(address pm) external onlyOwner {
        if (address(permissionManager) != address(0)) revert AlreadySet();
        if (pm == address(0)) revert ZeroAddress();
        permissionManager = IPermissionManager(pm);
        emit PermissionManagerSet(pm);
    }

    function setDisputeManager(address dm) external onlyOwner {
        if (disputeManager != address(0)) revert AlreadySet();
        if (dm == address(0)) revert ZeroAddress();
        disputeManager = dm;
        emit DisputeManagerSet(dm);
    }

    function setGuardian(address g) external onlyOwner {
        if (g == address(0)) revert ZeroAddress();
        guardian = g;
        emit GuardianSet(g);
    }

    /// @dev Circuit breaker. Blocks NEW commitments only (see whenNotPaused
    /// usage); approvals, settlement, refunds, and withdrawals remain open so
    /// an emergency can never trap user funds.
    function setPaused(bool p) external {
        if (msg.sender != guardian && msg.sender != owner()) revert NotGuardian();
        paused = p;
        emit PausedSet(p);
    }

    // --- creation ---

    function createAgreement(uint256 jobId, uint256 bidId) external whenNotPaused returns (uint256 id) {
        IJobRegistry.Job memory job = jobs.getJob(jobId);
        if (job.status != JobStatus.OPEN) revert JobNotOpen();
        if (!_authorized(job.employerProfileId, Capabilities.ACCEPT_BID)) revert NotEmployer();

        IBidRegistry.Bid memory bid = bids.getBid(bidId);
        if (bid.jobId != jobId) revert BidNotForJob();
        if (bid.status != BidStatus.SUBMITTED) revert BidNotForJob();
        if (!profiles.isActive(job.employerProfileId) || !profiles.isActive(bid.freelancerProfileId)) {
            revert ProfileNotActive();
        }
        if (agreementOfJob[jobId] != 0) revert AgreementExistsForJob();

        id = ++agreementCount;
        uint256 vaultId = vault.createVault(id, job.paymentToken);

        Agreement storage a = _agreements[id];
        a.jobId = jobId;
        a.bidId = bidId;
        a.employerProfileId = job.employerProfileId;
        a.freelancerProfileId = bid.freelancerProfileId;
        a.paymentToken = job.paymentToken;
        a.totalAmount = bid.amount;
        a.vaultId = vaultId;
        a.model = job.model;
        a.status = AgreementStatus.ACTIVE;
        a.createdAt = uint64(block.timestamp);

        agreementOfJob[jobId] = id;
        jobs.markFilled(jobId);
        bids.markAccepted(bidId);

        emit AgreementCreated(id, jobId, bidId);
        emit AgreementActivated(id);
    }

    // --- funding & work lifecycle ---

    function fundVault(uint256 agreementId, uint256 amount) external whenNotPaused {
        Agreement storage a = _active(agreementId);
        _requireEmployer(a, Capabilities.FUND_VAULT);
        vault.pullDeposit(a.vaultId, msg.sender, amount); // pulls from caller (approved Vault)
    }

    function addWorkUnit(uint256 agreementId, uint64 sequence, uint256 amount, bytes32 metadataCID)
        external
        whenNotPaused
        returns (uint256 workUnitId)
    {
        Agreement storage a = _active(agreementId);
        _requireEmployer(a, Capabilities.ACCEPT_BID);
        if (a.allocated + amount > a.totalAmount) revert AllocationExceedsTotal(); // §5
        workUnitId = workUnits.createWorkUnit(agreementId, sequence, amount, metadataCID);
        a.allocated += amount;
        a.outstandingUnits += 1;
        emit WorkUnitAdded(agreementId, workUnitId, amount);
    }

    function startWork(uint256 workUnitId) external whenNotPaused {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId);
        _requireFreelancer(a, Capabilities.SUBMIT_WORK);
        if (vault.available(a.vaultId) < u.amount) revert Underfunded(); // §4
        workUnits.setInProgress(workUnitId);
    }

    /// @dev Covers both first submission (IN_PROGRESS) and resubmission
    /// (REVISION_REQUESTED); the WorkUnitManager enforces the valid source state.
    function submitWork(uint256 workUnitId, bytes32 submissionCID) external {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId);
        _requireFreelancer(a, Capabilities.SUBMIT_WORK);
        workUnits.setSubmitted(workUnitId, submissionCID);
    }

    function requestRevision(uint256 workUnitId) external {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId);
        _requireEmployer(a, Capabilities.APPROVE_WORK);
        workUnits.setRevisionRequested(workUnitId);
    }

    function approveWork(uint256 workUnitId) external {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId); // reverts if DISPUTED (§6)
        _requireEmployer(a, Capabilities.APPROVE_WORK);
        workUnits.setApproved(workUnitId);
    }

    /// @dev §7 liveness escape: anyone may force-approve a unit left SUBMITTED
    /// past the window, so an unresponsive employer can't trap funds.
    function claimApproval(uint256 workUnitId) external {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId);
        if (u.status != WorkUnitStatus.SUBMITTED) revert NotSubmitted();
        // Clock resumes from the later of submission or the last dispute clearing.
        uint64 since = u.submittedAt > a.lastDisputeClearedAt ? u.submittedAt : a.lastDisputeClearedAt;
        if (block.timestamp < since + APPROVAL_WINDOW) revert ApprovalWindowNotElapsed();
        workUnits.setApproved(workUnitId);
    }

    /// @dev Permissionless: settling an APPROVED unit moves already-authorized
    /// funds to the freelancer with no discretion, so anyone may trigger it —
    /// one less liveness dependency.
    function settleWorkUnit(uint256 workUnitId) external {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId); // reverts if DISPUTED (§6)

        // setSettled first: it requires APPROVED, so a re-settle reverts cleanly
        // here (not via an outstandingUnits underflow). Effects before interaction.
        workUnits.setSettled(workUnitId);
        a.outstandingUnits -= 1;
        vault.releasePayment(a.vaultId, profiles.ownerOf(a.freelancerProfileId), u.amount);
        reputation.recordSettlement(u.agreementId, a.employerProfileId, a.freelancerProfileId, u.amount);
        emit WorkUnitSettled(u.agreementId, workUnitId, u.amount);
    }

    /// @dev §M1 employer liveness escape, symmetric to the freelancer's
    /// claimApproval: void a unit the freelancer never carried to APPROVED once
    /// the approval window has elapsed with no pending submission. Frees the
    /// allocation and outstanding count so the agreement can complete and refund,
    /// instead of being locked until a dispute. The window protects an actively
    /// working freelancer — a SUBMITTED unit is not cancellable (it has its own
    /// claimApproval path), and resubmitting resets the clock via submittedAt.
    function cancelWorkUnit(uint256 workUnitId) external {
        IWorkUnitManager.WorkUnit memory u = workUnits.getWorkUnit(workUnitId);
        Agreement storage a = _active(u.agreementId);
        _requireEmployer(a, Capabilities.ACCEPT_BID);

        WorkUnitStatus st = u.status;
        if (
            st != WorkUnitStatus.CREATED && st != WorkUnitStatus.IN_PROGRESS
                && st != WorkUnitStatus.REVISION_REQUESTED
        ) revert NotCancellable();

        uint64 ref = u.submittedAt != 0 ? u.submittedAt : u.createdAt;
        uint64 since = ref > a.lastDisputeClearedAt ? ref : a.lastDisputeClearedAt; // §D1
        if (block.timestamp < since + APPROVAL_WINDOW) revert ApprovalWindowNotElapsed();

        workUnits.setCancelled(workUnitId);
        a.allocated -= u.amount;
        a.outstandingUnits -= 1;
        emit WorkUnitCancelled(u.agreementId, workUnitId, u.amount);
    }

    // --- closure ---

    function completeAgreement(uint256 agreementId) external {
        Agreement storage a = _active(agreementId);
        _requireEmployer(a, Capabilities.ACCEPT_BID);
        if (a.outstandingUnits != 0) revert OutstandingUnits();
        _refundRemainder(a);
        a.status = AgreementStatus.COMPLETED;
        a.completedAt = uint64(block.timestamp);
        jobs.markCompleted(a.jobId);
        emit AgreementCompleted(agreementId);
    }

    function terminateAgreement(uint256 agreementId) external {
        Agreement storage a = _active(agreementId);
        _requireEmployer(a, Capabilities.ACCEPT_BID);
        if (a.outstandingUnits != 0) revert OutstandingUnits(); // mid-work exit -> dispute
        _refundRemainder(a);
        a.status = AgreementStatus.TERMINATED;
        a.completedAt = uint64(block.timestamp);
        jobs.markCancelled(a.jobId); // §L4: don't strand the job in FILLED
        emit AgreementTerminated(agreementId);
    }

    // --- dispute hooks (DisputeManager-only, §6) ---

    function disputeView(uint256 agreementId)
        external
        view
        returns (uint256 employerProfileId, uint256 freelancerProfileId, AgreementStatus status)
    {
        Agreement storage a = _agreements[agreementId];
        if (a.status == AgreementStatus.NONE) revert AgreementNotFound();
        return (a.employerProfileId, a.freelancerProfileId, a.status);
    }

    function markDisputed(uint256 agreementId) external onlyDisputeManager {
        Agreement storage a = _agreements[agreementId];
        if (a.status != AgreementStatus.ACTIVE) revert NotActive();
        a.status = AgreementStatus.DISPUTED;
        emit AgreementDisputed(agreementId);
    }

    function markDismissed(uint256 agreementId) external onlyDisputeManager {
        Agreement storage a = _agreements[agreementId];
        if (a.status != AgreementStatus.DISPUTED) revert NotDisputed();
        a.status = AgreementStatus.ACTIVE;
        a.lastDisputeClearedAt = uint64(block.timestamp); // §D1: resume liveness clocks
        emit AgreementDisputeDismissed(agreementId);
    }

    /// @dev Resolver must distribute the entire available balance.
    function resolveDispute(uint256 agreementId, uint256 freelancerAmount, uint256 employerRefund)
        external
        onlyDisputeManager
    {
        Agreement storage a = _agreements[agreementId];
        if (a.status != AgreementStatus.DISPUTED) revert NotDisputed();

        uint256 avail = vault.available(a.vaultId);
        if (freelancerAmount + employerRefund != avail) revert InvalidDistribution();

        if (freelancerAmount > 0) {
            vault.releasePayment(a.vaultId, profiles.ownerOf(a.freelancerProfileId), freelancerAmount);
            reputation.recordSettlement(agreementId, a.employerProfileId, a.freelancerProfileId, freelancerAmount);
        }
        if (employerRefund > 0) {
            vault.refund(a.vaultId, profiles.ownerOf(a.employerProfileId), employerRefund);
        }

        a.status = AgreementStatus.RESOLVED;
        a.completedAt = uint64(block.timestamp);
        emit AgreementResolved(agreementId, freelancerAmount, employerRefund);
    }

    // --- views ---

    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        if (_agreements[agreementId].status == AgreementStatus.NONE) revert AgreementNotFound();
        return _agreements[agreementId];
    }

    function exists(uint256 agreementId) external view returns (bool) {
        return _agreements[agreementId].status != AgreementStatus.NONE;
    }

    // --- internals ---

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyDisputeManager() {
        if (msg.sender != disputeManager) revert NotDisputeManager();
        _;
    }

    function _active(uint256 agreementId) private view returns (Agreement storage a) {
        a = _agreements[agreementId];
        if (a.status == AgreementStatus.NONE) revert AgreementNotFound();
        if (a.status != AgreementStatus.ACTIVE) revert NotActive();
    }

    function _refundRemainder(Agreement storage a) private {
        uint256 rem = vault.available(a.vaultId);
        if (rem > 0) vault.refund(a.vaultId, profiles.ownerOf(a.employerProfileId), rem);
    }

    /// @dev True if caller owns the profile or holds the delegated capability.
    /// ponytail: ~6 lines duplicated across Job/Bid/Agreement instead of a base
    /// that mixes Ownable into the inheritance diamond.
    function _authorized(uint256 profileId, uint256 cap) private view returns (bool) {
        if (profiles.ownerOf(profileId) == msg.sender) return true;
        IPermissionManager pm = permissionManager;
        return address(pm) != address(0) && pm.hasPermission(profileId, msg.sender, cap);
    }

    function _requireEmployer(Agreement storage a, uint256 cap) private view {
        if (!_authorized(a.employerProfileId, cap)) revert NotEmployer();
    }

    function _requireFreelancer(Agreement storage a, uint256 cap) private view {
        if (!_authorized(a.freelancerProfileId, cap)) revert NotFreelancer();
    }
}
