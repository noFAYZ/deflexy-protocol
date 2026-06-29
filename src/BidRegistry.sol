// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BidStatus, JobStatus} from "./libraries/Types.sol";
import {Capabilities} from "./libraries/Capabilities.sol";
import {IBidRegistry, IProfileRegistry, IJobRegistry, IPermissionManager} from "./interfaces/Interfaces.sol";
import {Wired} from "./utils/Wired.sol";
import {ZeroAddress} from "./utils/Errors.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Bid lifecycle. Freelancers submit/withdraw; ACCEPTED/REJECTED are
/// driven by the AgreementRegistry on bid acceptance.
contract BidRegistry is IBidRegistry, Wired {
    IProfileRegistry public immutable profiles;
    IJobRegistry public immutable jobs;
    /// @dev Optional delegation authority. Zero = owner-only.
    IPermissionManager public permissionManager;

    uint256 public bidCount;
    mapping(uint256 => Bid) private _bids;

    event BidSubmitted(
        uint256 indexed bidId, uint256 indexed jobId, uint256 indexed freelancerProfileId, uint256 amount
    );
    event BidWithdrawn(uint256 indexed bidId);
    event BidAccepted(uint256 indexed bidId);

    error NotProfileOwner();
    error ProfileNotActive();
    error JobNotOpen();
    error BidNotFound();
    error BidNotSubmitted();
    error InvalidAmount();
    error AlreadySet();

    constructor(address owner_, address profileRegistry, address jobRegistry) Ownable(owner_) {
        profiles = IProfileRegistry(profileRegistry);
        jobs = IJobRegistry(jobRegistry);
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

    function submitBid(
        uint256 jobId,
        uint256 freelancerProfileId,
        uint256 amount,
        uint64 estimatedDuration,
        bytes32 proposalCID
    ) external returns (uint256 id) {
        if (!_authorized(freelancerProfileId, Capabilities.SUBMIT_BID)) revert NotProfileOwner();
        if (!profiles.isActive(freelancerProfileId)) revert ProfileNotActive();
        if (jobs.getJob(jobId).status != JobStatus.OPEN) revert JobNotOpen();
        if (amount == 0) revert InvalidAmount();

        id = ++bidCount;
        _bids[id] = Bid({
            jobId: jobId,
            freelancerProfileId: freelancerProfileId,
            amount: amount,
            estimatedDuration: estimatedDuration,
            status: BidStatus.SUBMITTED,
            proposalCID: proposalCID,
            createdAt: uint64(block.timestamp)
        });
        emit BidSubmitted(id, jobId, freelancerProfileId, amount);
    }

    function withdrawBid(uint256 bidId) external {
        Bid storage b = _bids[bidId];
        if (b.status == BidStatus.NONE) revert BidNotFound();
        if (!_authorized(b.freelancerProfileId, Capabilities.SUBMIT_BID)) revert NotProfileOwner();
        if (b.status != BidStatus.SUBMITTED) revert BidNotSubmitted();
        b.status = BidStatus.WITHDRAWN;
        emit BidWithdrawn(bidId);
    }

    // --- AgreementRegistry-driven transitions ---

    function markAccepted(uint256 bidId) external onlyAgreementRegistry {
        Bid storage b = _bids[bidId];
        if (b.status != BidStatus.SUBMITTED) revert BidNotSubmitted();
        b.status = BidStatus.ACCEPTED;
        emit BidAccepted(bidId);
    }

    function getBid(uint256 bidId) external view returns (Bid memory) {
        if (_bids[bidId].status == BidStatus.NONE) revert BidNotFound();
        return _bids[bidId];
    }
}
