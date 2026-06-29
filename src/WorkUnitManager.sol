// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {WorkUnitStatus} from "./libraries/Types.sol";
import {IWorkUnitManager} from "./interfaces/Interfaces.sol";
import {Wired} from "./utils/Wired.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Dumb work-unit state store. Every mutator is onlyAgreementRegistry
/// (hardening §10): identity, funding, and dispute checks live in the
/// orchestrator, keeping this module dependency-free and the transition table
/// the single thing it must get right.
contract WorkUnitManager is IWorkUnitManager, Wired {
    uint256 public workUnitCount;
    mapping(uint256 => WorkUnit) private _units;
    // agreementId => sequence => used (sequence uniqueness within an agreement)
    mapping(uint256 => mapping(uint64 => bool)) public sequenceUsed;

    event WorkUnitCreated(uint256 indexed id, uint256 indexed agreementId, uint64 sequence, uint256 amount);
    event WorkStarted(uint256 indexed id);
    event WorkSubmitted(uint256 indexed id, bytes32 submissionCID);
    event RevisionRequested(uint256 indexed id);
    event WorkApproved(uint256 indexed id);
    event WorkSettled(uint256 indexed id);
    event WorkCancelled(uint256 indexed id);

    error WorkUnitNotFound();
    error InvalidAmount();
    error DuplicateSequence();
    error InvalidState();

    constructor(address owner_) Ownable(owner_) {}

    function createWorkUnit(uint256 agreementId, uint64 sequence, uint256 amount, bytes32 metadataCID)
        external
        onlyAgreementRegistry
        returns (uint256 id)
    {
        if (amount == 0) revert InvalidAmount();
        if (sequenceUsed[agreementId][sequence]) revert DuplicateSequence();
        sequenceUsed[agreementId][sequence] = true;

        id = ++workUnitCount;
        WorkUnit storage u = _units[id];
        u.agreementId = agreementId;
        u.sequence = sequence;
        u.amount = amount;
        u.metadataCID = metadataCID;
        u.status = WorkUnitStatus.CREATED;
        u.createdAt = uint64(block.timestamp);
        emit WorkUnitCreated(id, agreementId, sequence, amount);
    }

    function setInProgress(uint256 id) external onlyAgreementRegistry {
        WorkUnit storage u = _load(id);
        if (u.status != WorkUnitStatus.CREATED) revert InvalidState();
        u.status = WorkUnitStatus.IN_PROGRESS;
        emit WorkStarted(id);
    }

    function setSubmitted(uint256 id, bytes32 submissionCID) external onlyAgreementRegistry {
        WorkUnit storage u = _load(id);
        if (u.status != WorkUnitStatus.IN_PROGRESS && u.status != WorkUnitStatus.REVISION_REQUESTED) {
            revert InvalidState();
        }
        u.submissionCID = submissionCID;
        u.submittedAt = uint64(block.timestamp); // resets the approval clock (§7)
        u.status = WorkUnitStatus.SUBMITTED;
        emit WorkSubmitted(id, submissionCID);
    }

    function setRevisionRequested(uint256 id) external onlyAgreementRegistry {
        WorkUnit storage u = _load(id);
        if (u.status != WorkUnitStatus.SUBMITTED) revert InvalidState();
        u.status = WorkUnitStatus.REVISION_REQUESTED;
        emit RevisionRequested(id);
    }

    function setApproved(uint256 id) external onlyAgreementRegistry {
        WorkUnit storage u = _load(id);
        if (u.status != WorkUnitStatus.SUBMITTED) revert InvalidState();
        u.approvedAt = uint64(block.timestamp);
        u.status = WorkUnitStatus.APPROVED;
        emit WorkApproved(id);
    }

    function setSettled(uint256 id) external onlyAgreementRegistry {
        WorkUnit storage u = _load(id);
        if (u.status != WorkUnitStatus.APPROVED) revert InvalidState();
        u.status = WorkUnitStatus.SETTLED;
        emit WorkSettled(id);
    }

    /// @dev Employer escape (§7-symmetric): voids a unit the freelancer never
    /// carried to APPROVED. The AgreementRegistry enforces the timeout and frees
    /// the allocation; here we only gate the valid source states.
    function setCancelled(uint256 id) external onlyAgreementRegistry {
        WorkUnit storage u = _load(id);
        if (
            u.status != WorkUnitStatus.CREATED && u.status != WorkUnitStatus.IN_PROGRESS
                && u.status != WorkUnitStatus.REVISION_REQUESTED
        ) revert InvalidState();
        u.status = WorkUnitStatus.CANCELLED;
        emit WorkCancelled(id);
    }

    function getWorkUnit(uint256 id) external view returns (WorkUnit memory) {
        return _load(id);
    }

    function _load(uint256 id) private view returns (WorkUnit storage u) {
        u = _units[id];
        if (u.status == WorkUnitStatus.NONE) revert WorkUnitNotFound();
    }
}
