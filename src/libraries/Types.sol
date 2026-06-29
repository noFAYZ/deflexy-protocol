// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Shared protocol enums. State 0 is always the "does not exist" sentinel so a
// zero-initialized storage slot reads as absent.

enum ProfileStatus {
    NONE,
    ACTIVE,
    ARCHIVED
}

enum JobStatus {
    NONE,
    OPEN,
    FILLED,
    COMPLETED,
    CANCELLED
}

enum BidStatus {
    NONE,
    SUBMITTED,
    ACCEPTED,
    WITHDRAWN,
    REJECTED
}

enum SettlementModel {
    FIXED,
    MILESTONE,
    HOURLY,
    SUBSCRIPTION
}

enum AgreementStatus {
    NONE,
    ACTIVE,
    DISPUTED,
    RESOLVED,
    COMPLETED,
    TERMINATED
}

enum VaultStatus {
    NONE,
    FUNDED,
    EXHAUSTED,
    REFUNDED
}

enum WorkUnitStatus {
    NONE,
    CREATED,
    IN_PROGRESS,
    SUBMITTED,
    REVISION_REQUESTED,
    APPROVED,
    SETTLED,
    CANCELLED
}

enum DisputeStatus {
    NONE,
    OPEN,
    UNDER_REVIEW,
    RESOLVED,
    DISMISSED
}

enum DisputeOutcome {
    NONE,
    EMPLOYER_PREVAILS,
    FREELANCER_PREVAILS,
    SPLIT,
    TERMINATED
}
