// On-chain enum indices (mirror src/libraries/Types.sol). State 0 = "does not exist".

export enum ProfileStatus { None, Active, Archived }
export enum JobStatus { None, Open, Filled, Completed, Cancelled }
export enum BidStatus { None, Submitted, Accepted, Withdrawn, Rejected }
export enum SettlementModel { Fixed, Milestone, Hourly, Subscription }
export enum AgreementStatus { None, Active, Disputed, Resolved, Completed, Terminated }
export enum WorkUnitStatus { None, Created, InProgress, Submitted, RevisionRequested, Approved, Settled }
export enum VaultStatus { None, Funded, Exhausted, Refunded }
export enum DisputeStatus { None, Open, UnderReview, Resolved, Dismissed }
export enum DisputeOutcome { None, EmployerPrevails, FreelancerPrevails, Split, Terminated }

/** Delegated-permission capability bits (PermissionManager). Combine with bitwise OR. */
export const Capability = {
  CreateJob: 1n << 0n,
  CancelJob: 1n << 1n,
  SubmitBid: 1n << 2n,
  AcceptBid: 1n << 3n,
  FundVault: 1n << 4n,
  SubmitWork: 1n << 5n,
  ApproveWork: 1n << 6n,
  OpenDispute: 1n << 7n,
  ManageProfile: 1n << 8n,
} as const;
