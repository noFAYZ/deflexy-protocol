import { onchainTable } from "ponder";

// Status fields store the on-chain enum index (see src/libraries/Types.sol);
// the SDK maps them to names. Amounts are token base units (bigint).

export const profile = onchainTable("profile", (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.hex().notNull(),
  metadataCID: t.hex().notNull(),
  status: t.integer().notNull(), // 1 ACTIVE, 2 ARCHIVED
  createdAt: t.bigint().notNull(),
}));

export const job = onchainTable("job", (t) => ({
  id: t.bigint().primaryKey(),
  employerProfileId: t.bigint().notNull(),
  paymentToken: t.hex().notNull(),
  budget: t.bigint().notNull(),
  model: t.integer().notNull(), // 0 FIXED, 1 MILESTONE, 2 HOURLY, 3 SUBSCRIPTION
  status: t.integer().notNull(), // 1 OPEN, 2 FILLED, 3 COMPLETED, 4 CANCELLED
  metadataCID: t.hex().notNull(),
  agreementId: t.bigint(),
  createdAt: t.bigint().notNull(),
}));

export const bid = onchainTable("bid", (t) => ({
  id: t.bigint().primaryKey(),
  jobId: t.bigint().notNull(),
  freelancerProfileId: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  status: t.integer().notNull(), // 1 SUBMITTED, 2 ACCEPTED, 3 WITHDRAWN, 4 REJECTED
  createdAt: t.bigint().notNull(),
}));

export const agreement = onchainTable("agreement", (t) => ({
  id: t.bigint().primaryKey(),
  jobId: t.bigint().notNull(),
  bidId: t.bigint().notNull(),
  employerProfileId: t.bigint().notNull(),
  freelancerProfileId: t.bigint().notNull(),
  paymentToken: t.hex().notNull(),
  totalAmount: t.bigint().notNull(),
  vaultId: t.bigint().notNull(),
  model: t.integer().notNull(),
  status: t.integer().notNull(), // 1 ACTIVE, 2 DISPUTED, 3 RESOLVED, 4 COMPLETED, 5 TERMINATED
  createdAt: t.bigint().notNull(),
  completedAt: t.bigint(),
}));

export const workUnit = onchainTable("work_unit", (t) => ({
  id: t.bigint().primaryKey(),
  agreementId: t.bigint().notNull(),
  sequence: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  status: t.integer().notNull(), // 1 CREATED..6 SETTLED
  submissionCID: t.hex(),
  createdAt: t.bigint().notNull(),
  submittedAt: t.bigint(),
  approvedAt: t.bigint(),
  settledAt: t.bigint(),
}));

export const vault = onchainTable("vault", (t) => ({
  id: t.bigint().primaryKey(),
  agreementId: t.bigint().notNull(),
  token: t.hex().notNull(),
  deposited: t.bigint().notNull(),
  released: t.bigint().notNull(),
  refunded: t.bigint().notNull(),
  status: t.integer().notNull(), // 0 NONE, 1 FUNDED, 2 EXHAUSTED, 3 REFUNDED
}));

// Append-only ledger of every token movement (deposit/release/refund/fee/withdrawal).
export const payment = onchainTable("payment", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  vaultId: t.bigint(), // null for withdrawals (not vault-scoped)
  kind: t.text().notNull(),
  account: t.hex(),
  token: t.hex(),
  amount: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const dispute = onchainTable("dispute", (t) => ({
  id: t.bigint().primaryKey(),
  agreementId: t.bigint().notNull(),
  initiator: t.hex().notNull(),
  status: t.integer().notNull(), // 1 OPEN, 2 UNDER_REVIEW, 3 RESOLVED, 4 DISMISSED
  outcome: t.integer(),
  createdAt: t.bigint().notNull(),
  resolvedAt: t.bigint(),
}));

export const reputation = onchainTable("reputation", (t) => ({
  id: t.bigint().primaryKey(), // profileId
  completedAsFreelancer: t.bigint().notNull(),
  completedAsEmployer: t.bigint().notNull(),
  volumeAsFreelancer: t.bigint().notNull(),
}));

// agreementId -> vaultId. VaultCreated fires just before AgreementCreated in the
// same tx, so this lets AgreementCreated set its vaultId without an RPC read.
export const agreementVault = onchainTable("agreement_vault", (t) => ({
  id: t.bigint().primaryKey(), // agreementId
  vaultId: t.bigint().notNull(),
}));
