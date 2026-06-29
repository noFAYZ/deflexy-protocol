// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {JobStatus, SettlementModel, ProfileStatus} from "./libraries/Types.sol";
import {Capabilities} from "./libraries/Capabilities.sol";
import {IJobRegistry, IProfileRegistry, IPermissionManager} from "./interfaces/Interfaces.sol";
import {Wired} from "./utils/Wired.sol";
import {ZeroAddress} from "./utils/Errors.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Job lifecycle. Created directly OPEN; FILLED/COMPLETED are driven by
/// the AgreementRegistry. ponytail: no DRAFT state — drafts are an app concern,
/// add on-chain only if a draft must be discoverable by indexers.
contract JobRegistry is IJobRegistry, Wired {
    IProfileRegistry public immutable profiles;
    /// @dev Optional delegation authority. Zero = owner-only.
    IPermissionManager public permissionManager;

    uint256 public jobCount;
    mapping(uint256 => Job) private _jobs;

    event JobCreated(
        uint256 indexed jobId,
        uint256 indexed employerProfileId,
        address paymentToken,
        uint256 budget,
        SettlementModel model,
        bytes32 metadataCID
    );
    event JobCancelled(uint256 indexed jobId);
    event JobFilled(uint256 indexed jobId);
    event JobCompleted(uint256 indexed jobId);

    error NotProfileOwner();
    error ProfileNotActive();
    error JobNotFound();
    error JobNotOpen();
    error JobNotFilled();
    error InvalidBudget();
    error InvalidToken();
    error AlreadySet();

    constructor(address owner_, address profileRegistry) Ownable(owner_) {
        profiles = IProfileRegistry(profileRegistry);
    }

    function setPermissionManager(address pm) external onlyOwner {
        if (address(permissionManager) != address(0)) revert AlreadySet();
        if (pm == address(0)) revert ZeroAddress();
        permissionManager = IPermissionManager(pm);
    }

    function _authorized(uint256 profileId, uint256 cap) internal view returns (bool) {
        if (profiles.ownerOf(profileId) == msg.sender) return true;
        IPermissionManager pm = permissionManager;
        return address(pm) != address(0) && pm.hasPermission(profileId, msg.sender, cap);
    }

    function createJob(
        uint256 employerProfileId,
        address paymentToken,
        uint256 budget,
        SettlementModel model,
        bytes32 metadataCID
    ) external returns (uint256 id) {
        if (!_authorized(employerProfileId, Capabilities.CREATE_JOB)) revert NotProfileOwner();
        if (!profiles.isActive(employerProfileId)) revert ProfileNotActive();
        if (budget == 0) revert InvalidBudget();
        if (paymentToken == address(0)) revert InvalidToken();

        id = ++jobCount;
        _jobs[id] = Job({
            employerProfileId: employerProfileId,
            paymentToken: paymentToken,
            budget: budget,
            model: model,
            status: JobStatus.OPEN,
            metadataCID: metadataCID,
            createdAt: uint64(block.timestamp)
        });
        emit JobCreated(id, employerProfileId, paymentToken, budget, model, metadataCID);
    }

    function cancelJob(uint256 jobId) external {
        Job storage j = _jobs[jobId];
        if (j.status == JobStatus.NONE) revert JobNotFound();
        if (!_authorized(j.employerProfileId, Capabilities.CANCEL_JOB)) revert NotProfileOwner();
        if (j.status != JobStatus.OPEN) revert JobNotOpen();
        j.status = JobStatus.CANCELLED;
        emit JobCancelled(jobId);
    }

    // --- AgreementRegistry-driven transitions ---

    function markFilled(uint256 jobId) external onlyAgreementRegistry {
        Job storage j = _jobs[jobId];
        if (j.status != JobStatus.OPEN) revert JobNotOpen();
        j.status = JobStatus.FILLED;
        emit JobFilled(jobId);
    }

    function markCompleted(uint256 jobId) external onlyAgreementRegistry {
        Job storage j = _jobs[jobId];
        if (j.status != JobStatus.FILLED) revert JobNotFilled();
        j.status = JobStatus.COMPLETED;
        emit JobCompleted(jobId);
    }

    /// @dev Agreement terminated mid-life — release the job from FILLED so it
    /// isn't stranded for indexers (§L4). Terminal: not re-openable.
    function markCancelled(uint256 jobId) external onlyAgreementRegistry {
        Job storage j = _jobs[jobId];
        if (j.status != JobStatus.FILLED) revert JobNotFilled();
        j.status = JobStatus.CANCELLED;
        emit JobCancelled(jobId);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        if (_jobs[jobId].status == JobStatus.NONE) revert JobNotFound();
        return _jobs[jobId];
    }
}
