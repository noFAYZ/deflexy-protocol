// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AgreementStatus, DisputeStatus, DisputeOutcome} from "../libraries/Types.sol";
import {IAgreementRegistry, IProfileRegistry} from "../interfaces/Interfaces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Dispute lifecycle + metadata. It is the AgreementRegistry's single
/// trusted dispute authority (wired set-once there). The arbitrator — this
/// contract's owner, intended to be a DAO / multisig / arbitration provider —
/// is an explicit trust assumption (hardening §6): it can direct escrowed funds
/// during a dispute. It never custodies funds; settlement runs through the
/// VaultManager via the AgreementRegistry.
contract DisputeManager is Ownable {
    IAgreementRegistry public immutable agreements;
    IProfileRegistry public immutable profiles;

    struct Dispute {
        uint256 agreementId;
        uint256 employerProfileId;
        uint256 freelancerProfileId;
        address initiator;
        DisputeStatus status;
        DisputeOutcome outcome;
        bytes32 evidenceCID;
        bytes32 resolutionCID;
        uint64 createdAt;
        uint64 resolvedAt;
    }

    uint256 public disputeCount;
    mapping(uint256 => Dispute) private _disputes;
    mapping(uint256 => uint256) public openDisputeOf; // agreementId => disputeId (current)

    event DisputeOpened(uint256 indexed disputeId, uint256 indexed agreementId, address indexed initiator);
    event EvidenceSubmitted(uint256 indexed disputeId, address indexed by, bytes32 evidenceCID);
    event ReviewBegun(uint256 indexed disputeId);
    event DisputeResolved(
        uint256 indexed disputeId, DisputeOutcome outcome, uint256 freelancerAmount, uint256 employerRefund
    );
    event DisputeDismissed(uint256 indexed disputeId);

    error AgreementNotActive();
    error NotParticipant();
    error DisputeNotFound();
    error InvalidState();
    error InvalidOutcome();

    constructor(address arbitrator, address agreementRegistry, address profileRegistry) Ownable(arbitrator) {
        agreements = IAgreementRegistry(agreementRegistry);
        profiles = IProfileRegistry(profileRegistry);
    }

    // --- participant actions ---

    function openDispute(uint256 agreementId, bytes32 evidenceCID) external returns (uint256 id) {
        (uint256 emp, uint256 free, AgreementStatus status) = agreements.disputeView(agreementId);
        if (status != AgreementStatus.ACTIVE) revert AgreementNotActive();
        if (msg.sender != profiles.ownerOf(emp) && msg.sender != profiles.ownerOf(free)) {
            revert NotParticipant();
        }

        id = ++disputeCount;
        Dispute storage d = _disputes[id];
        d.agreementId = agreementId;
        d.employerProfileId = emp;
        d.freelancerProfileId = free;
        d.initiator = msg.sender;
        d.status = DisputeStatus.OPEN;
        d.evidenceCID = evidenceCID;
        d.createdAt = uint64(block.timestamp);
        openDisputeOf[agreementId] = id;

        // Locks settlement on the agreement; reverts unless it is ACTIVE.
        agreements.markDisputed(agreementId);
        emit DisputeOpened(id, agreementId, msg.sender);
    }

    function submitEvidence(uint256 disputeId, bytes32 evidenceCID) external {
        Dispute storage d = _load(disputeId);
        if (d.status != DisputeStatus.OPEN && d.status != DisputeStatus.UNDER_REVIEW) revert InvalidState();
        if (
            msg.sender != profiles.ownerOf(d.employerProfileId)
                && msg.sender != profiles.ownerOf(d.freelancerProfileId)
        ) revert NotParticipant();
        emit EvidenceSubmitted(disputeId, msg.sender, evidenceCID);
    }

    // --- arbitrator actions ---

    function beginReview(uint256 disputeId) external onlyOwner {
        Dispute storage d = _load(disputeId);
        if (d.status != DisputeStatus.OPEN) revert InvalidState();
        d.status = DisputeStatus.UNDER_REVIEW;
        emit ReviewBegun(disputeId);
    }

    function resolveDispute(
        uint256 disputeId,
        DisputeOutcome outcome,
        uint256 freelancerAmount,
        uint256 employerRefund,
        bytes32 resolutionCID
    ) external onlyOwner {
        Dispute storage d = _load(disputeId);
        if (d.status != DisputeStatus.UNDER_REVIEW) revert InvalidState();
        if (outcome == DisputeOutcome.NONE) revert InvalidOutcome();

        d.status = DisputeStatus.RESOLVED;
        d.outcome = outcome;
        d.resolutionCID = resolutionCID;
        d.resolvedAt = uint64(block.timestamp);
        openDisputeOf[d.agreementId] = 0;

        // AgreementRegistry validates that the split equals the available escrow.
        agreements.resolveDispute(d.agreementId, freelancerAmount, employerRefund);
        emit DisputeResolved(disputeId, outcome, freelancerAmount, employerRefund);
    }

    function dismissDispute(uint256 disputeId, bytes32 resolutionCID) external onlyOwner {
        Dispute storage d = _load(disputeId);
        if (d.status != DisputeStatus.OPEN && d.status != DisputeStatus.UNDER_REVIEW) revert InvalidState();
        d.status = DisputeStatus.DISMISSED;
        d.resolutionCID = resolutionCID;
        d.resolvedAt = uint64(block.timestamp);
        openDisputeOf[d.agreementId] = 0;

        agreements.markDismissed(d.agreementId); // returns agreement to ACTIVE
        emit DisputeDismissed(disputeId);
    }

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return _load(disputeId);
    }

    function _load(uint256 disputeId) private view returns (Dispute storage d) {
        d = _disputes[disputeId];
        if (d.status == DisputeStatus.NONE) revert DisputeNotFound();
    }
}
