// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {JobStatus, BidStatus, SettlementModel, WorkUnitStatus, AgreementStatus, DisputeOutcome} from "../libraries/Types.sol";

// ponytail: one file for all module interfaces. Split into per-file interfaces
// when external integrators need to import them individually.

interface IProfileRegistry {
    function ownerOf(uint256 profileId) external view returns (address);
    function isActive(uint256 profileId) external view returns (bool);
}

interface IJobRegistry {
    struct Job {
        uint256 employerProfileId;
        address paymentToken;
        uint256 budget;
        SettlementModel model;
        JobStatus status;
        bytes32 metadataCID;
        uint64 createdAt;
    }

    function getJob(uint256 jobId) external view returns (Job memory);
    function markFilled(uint256 jobId) external;
    function markCompleted(uint256 jobId) external;
    function markCancelled(uint256 jobId) external;
}

interface IBidRegistry {
    struct Bid {
        uint256 jobId;
        uint256 freelancerProfileId;
        uint256 amount;
        uint64 estimatedDuration;
        BidStatus status;
        bytes32 proposalCID;
        uint64 createdAt;
    }

    function getBid(uint256 bidId) external view returns (Bid memory);
    function markAccepted(uint256 bidId) external;
}

interface IVaultManager {
    function createVault(uint256 agreementId, address token) external returns (uint256 vaultId);
    function pullDeposit(uint256 vaultId, address payer, uint256 amount) external;
    function releasePayment(uint256 vaultId, address recipient, uint256 amount) external;
    function refund(uint256 vaultId, address recipient, uint256 amount) external;
    function available(uint256 vaultId) external view returns (uint256);
}

interface IWorkUnitManager {
    struct WorkUnit {
        uint256 agreementId;
        uint64 sequence;
        uint256 amount;
        WorkUnitStatus status;
        bytes32 metadataCID;
        bytes32 submissionCID;
        uint64 createdAt;
        uint64 submittedAt;
        uint64 approvedAt;
    }

    function createWorkUnit(uint256 agreementId, uint64 sequence, uint256 amount, bytes32 metadataCID)
        external
        returns (uint256 id);
    function setInProgress(uint256 id) external;
    function setSubmitted(uint256 id, bytes32 submissionCID) external;
    function setRevisionRequested(uint256 id) external;
    function setApproved(uint256 id) external;
    function setSettled(uint256 id) external;
    function setCancelled(uint256 id) external;
    function getWorkUnit(uint256 id) external view returns (WorkUnit memory);
}

interface IReputationRegistry {
    function recordSettlement(
        uint256 agreementId,
        uint256 employerProfileId,
        uint256 freelancerProfileId,
        uint256 amount
    ) external;
    function recordDispute(
        uint256 agreementId,
        uint256 employerProfileId,
        uint256 freelancerProfileId,
        DisputeOutcome outcome
    ) external;
}

interface IFeeManager {
    /// @return fee protocol fee, net recipient amount, treasury fee recipient.
    function quote(address token, uint256 amount)
        external
        view
        returns (uint256 fee, uint256 net, address treasury);

    /// @return feeBps effective fee in bps (0 if disabled), treasury recipient.
    /// Read once at vault creation so live config changes can't retro-skim escrow.
    function policy(address token) external view returns (uint16 feeBps, address treasury);
}

interface IPermissionManager {
    function hasPermission(uint256 profileId, address account, uint256 capability)
        external
        view
        returns (bool);
}

/// @dev Surface the AgreementRegistry exposes to the DisputeManager extension.
interface IAgreementRegistry {
    function disputeView(uint256 agreementId)
        external
        view
        returns (uint256 employerProfileId, uint256 freelancerProfileId, AgreementStatus status);
    function markDisputed(uint256 agreementId) external;
    function markDismissed(uint256 agreementId) external;
    function resolveDispute(
        uint256 agreementId,
        DisputeOutcome outcome,
        uint256 freelancerAmount,
        uint256 employerRefund
    ) external;
}
