// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DisputeOutcome} from "./libraries/Types.sol";
import {IReputationRegistry} from "./interfaces/Interfaces.sol";
import {Wired} from "./utils/Wired.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Append-only record of settled work AND dispute outcomes. The protocol
/// records facts; applications compute scores. Only the AgreementRegistry may
/// write (hardening §10). Recording dispute losses — not just happy-path volume
/// — is what makes the data resistant to a party that habitually under-delivers.
contract ReputationRegistry is IReputationRegistry, Wired {
    // profileId => aggregate facts
    mapping(uint256 => uint256) public completedAsFreelancer;
    mapping(uint256 => uint256) public completedAsEmployer;
    mapping(uint256 => uint256) public volumeAsFreelancer; // gross settled value

    // Dispute facts: total disputes a profile was party to, and how many it lost
    // (the arbitrator ruled wholly for the counterparty). SPLIT/TERMINATED count
    // as a dispute but not a loss for either side.
    mapping(uint256 => uint256) public disputesAsFreelancer;
    mapping(uint256 => uint256) public disputesLostAsFreelancer;
    mapping(uint256 => uint256) public disputesAsEmployer;
    mapping(uint256 => uint256) public disputesLostAsEmployer;

    event SettlementRecorded(
        uint256 indexed agreementId,
        uint256 indexed employerProfileId,
        uint256 indexed freelancerProfileId,
        uint256 amount
    );
    event DisputeRecorded(
        uint256 indexed agreementId,
        uint256 indexed employerProfileId,
        uint256 indexed freelancerProfileId,
        DisputeOutcome outcome
    );

    constructor(address owner_) Ownable(owner_) {}

    function recordSettlement(
        uint256 agreementId,
        uint256 employerProfileId,
        uint256 freelancerProfileId,
        uint256 amount
    ) external onlyAgreementRegistry {
        // Checked arithmetic: a wrapped volume/count would read as legitimate to
        // indexers. The gas delta is negligible for once-per-settlement writes.
        completedAsFreelancer[freelancerProfileId] += 1;
        completedAsEmployer[employerProfileId] += 1;
        volumeAsFreelancer[freelancerProfileId] += amount;
        emit SettlementRecorded(agreementId, employerProfileId, freelancerProfileId, amount);
    }

    function recordDispute(
        uint256 agreementId,
        uint256 employerProfileId,
        uint256 freelancerProfileId,
        DisputeOutcome outcome
    ) external onlyAgreementRegistry {
        disputesAsFreelancer[freelancerProfileId] += 1;
        disputesAsEmployer[employerProfileId] += 1;
        if (outcome == DisputeOutcome.EMPLOYER_PREVAILS) {
            disputesLostAsFreelancer[freelancerProfileId] += 1;
        } else if (outcome == DisputeOutcome.FREELANCER_PREVAILS) {
            disputesLostAsEmployer[employerProfileId] += 1;
        }
        emit DisputeRecorded(agreementId, employerProfileId, freelancerProfileId, outcome);
    }
}
