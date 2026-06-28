// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IReputationRegistry} from "./interfaces/Interfaces.sol";
import {Wired} from "./utils/Wired.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Append-only record of settled work. The protocol records facts;
/// applications compute scores. Only the AgreementRegistry may write, and only
/// from a settled Work Unit (hardening §10).
contract ReputationRegistry is IReputationRegistry, Wired {
    // profileId => aggregate facts
    mapping(uint256 => uint256) public completedAsFreelancer;
    mapping(uint256 => uint256) public completedAsEmployer;
    mapping(uint256 => uint256) public volumeAsFreelancer; // gross settled value

    event SettlementRecorded(
        uint256 indexed agreementId,
        uint256 indexed employerProfileId,
        uint256 indexed freelancerProfileId,
        uint256 amount
    );

    constructor(address owner_) Ownable(owner_) {}

    function recordSettlement(
        uint256 agreementId,
        uint256 employerProfileId,
        uint256 freelancerProfileId,
        uint256 amount
    ) external onlyAgreementRegistry {
        unchecked {
            completedAsFreelancer[freelancerProfileId] += 1;
            completedAsEmployer[employerProfileId] += 1;
            volumeAsFreelancer[freelancerProfileId] += amount;
        }
        emit SettlementRecorded(agreementId, employerProfileId, freelancerProfileId, amount);
    }
}
