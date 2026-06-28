// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProfileStatus} from "./libraries/Types.sol";
import {IProfileRegistry} from "./interfaces/Interfaces.sol";

/// @notice Protocol identity. One Profile per wallet. Owner is immutable; there
/// is no key recovery in v1 (hardening §9).
contract ProfileRegistry is IProfileRegistry {
    struct Profile {
        address owner;
        bytes32 metadataCID;
        ProfileStatus status;
        uint64 createdAt;
    }

    uint256 public profileCount;
    mapping(uint256 => Profile) private _profiles;
    mapping(address => uint256) public profileOf; // wallet => profileId (0 = none)

    event ProfileCreated(uint256 indexed profileId, address indexed owner, bytes32 metadataCID);
    event ProfileUpdated(uint256 indexed profileId, bytes32 metadataCID);
    event ProfileArchived(uint256 indexed profileId);

    error AlreadyHasProfile();
    error NotProfileOwner();
    error ProfileNotActive();
    error ProfileNotFound();

    function createProfile(bytes32 metadataCID) external returns (uint256 id) {
        if (profileOf[msg.sender] != 0) revert AlreadyHasProfile();
        id = ++profileCount;
        _profiles[id] = Profile(msg.sender, metadataCID, ProfileStatus.ACTIVE, uint64(block.timestamp));
        profileOf[msg.sender] = id;
        emit ProfileCreated(id, msg.sender, metadataCID);
    }

    function updateMetadata(uint256 profileId, bytes32 metadataCID) external {
        Profile storage p = _profiles[profileId];
        if (p.owner != msg.sender) revert NotProfileOwner();
        if (p.status != ProfileStatus.ACTIVE) revert ProfileNotActive();
        p.metadataCID = metadataCID;
        emit ProfileUpdated(profileId, metadataCID);
    }

    function archiveProfile(uint256 profileId) external {
        Profile storage p = _profiles[profileId];
        if (p.owner != msg.sender) revert NotProfileOwner();
        if (p.status != ProfileStatus.ACTIVE) revert ProfileNotActive();
        p.status = ProfileStatus.ARCHIVED;
        emit ProfileArchived(profileId);
    }

    // --- views ---

    function getProfile(uint256 profileId) external view returns (Profile memory) {
        if (_profiles[profileId].owner == address(0)) revert ProfileNotFound();
        return _profiles[profileId];
    }

    function ownerOf(uint256 profileId) external view returns (address) {
        return _profiles[profileId].owner;
    }

    function isActive(uint256 profileId) external view returns (bool) {
        return _profiles[profileId].status == ProfileStatus.ACTIVE;
    }
}
