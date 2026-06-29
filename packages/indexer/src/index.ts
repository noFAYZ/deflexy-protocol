import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const pid = (event: { transaction: { hash: string }; log: { logIndex: number } }) =>
  `${event.transaction.hash}-${event.log.logIndex}`;

// ---------- ProfileRegistry ----------

ponder.on("ProfileRegistry:ProfileCreated", async ({ event, context }) => {
  await context.db.insert(schema.profile).values({
    id: event.args.profileId,
    owner: event.args.owner,
    metadataCID: event.args.metadataCID,
    status: 1,
    createdAt: event.block.timestamp,
  });
});

ponder.on("ProfileRegistry:ProfileUpdated", async ({ event, context }) => {
  await context.db
    .update(schema.profile, { id: event.args.profileId })
    .set({ metadataCID: event.args.metadataCID });
});

ponder.on("ProfileRegistry:ProfileArchived", async ({ event, context }) => {
  await context.db.update(schema.profile, { id: event.args.profileId }).set({ status: 2 });
});

// ---------- JobRegistry ----------

ponder.on("JobRegistry:JobCreated", async ({ event, context }) => {
  await context.db.insert(schema.job).values({
    id: event.args.jobId,
    employerProfileId: event.args.employerProfileId,
    paymentToken: event.args.paymentToken,
    budget: event.args.budget,
    model: event.args.model,
    status: 1,
    metadataCID: event.args.metadataCID,
    agreementId: null,
    createdAt: event.block.timestamp,
  });
});

ponder.on("JobRegistry:JobCancelled", async ({ event, context }) => {
  await context.db.update(schema.job, { id: event.args.jobId }).set({ status: 4 });
});
ponder.on("JobRegistry:JobFilled", async ({ event, context }) => {
  await context.db.update(schema.job, { id: event.args.jobId }).set({ status: 2 });
});
ponder.on("JobRegistry:JobCompleted", async ({ event, context }) => {
  await context.db.update(schema.job, { id: event.args.jobId }).set({ status: 3 });
});

// ---------- BidRegistry ----------

ponder.on("BidRegistry:BidSubmitted", async ({ event, context }) => {
  await context.db.insert(schema.bid).values({
    id: event.args.bidId,
    jobId: event.args.jobId,
    freelancerProfileId: event.args.freelancerProfileId,
    amount: event.args.amount,
    status: 1,
    createdAt: event.block.timestamp,
  });
});

ponder.on("BidRegistry:BidWithdrawn", async ({ event, context }) => {
  await context.db.update(schema.bid, { id: event.args.bidId }).set({ status: 3 });
});
ponder.on("BidRegistry:BidAccepted", async ({ event, context }) => {
  await context.db.update(schema.bid, { id: event.args.bidId }).set({ status: 2 });
});

// ---------- AgreementRegistry ----------

ponder.on("AgreementRegistry:AgreementCreated", async ({ event, context }) => {
  const id = event.args.agreementId;
  const jobId = event.args.jobId;
  const bidId = event.args.bidId;
  // Build from already-indexed entities (no RPC read → no archive-call stalls).
  const job = await context.db.find(schema.job, { id: jobId });
  const bid = await context.db.find(schema.bid, { id: bidId });
  const av = await context.db.find(schema.agreementVault, { id });
  if (!job || !bid) return;
  await context.db.insert(schema.agreement).values({
    id,
    jobId,
    bidId,
    employerProfileId: job.employerProfileId,
    freelancerProfileId: bid.freelancerProfileId,
    paymentToken: job.paymentToken,
    totalAmount: bid.amount,
    vaultId: av?.vaultId ?? 0n,
    model: job.model,
    status: 1, // ACTIVE
    createdAt: event.block.timestamp,
    completedAt: null,
  });
  await context.db.update(schema.job, { id: jobId }).set({ agreementId: id });
});

ponder.on("AgreementRegistry:AgreementDisputed", async ({ event, context }) => {
  await context.db.update(schema.agreement, { id: event.args.agreementId }).set({ status: 2 });
});
ponder.on("AgreementRegistry:AgreementDisputeDismissed", async ({ event, context }) => {
  await context.db.update(schema.agreement, { id: event.args.agreementId }).set({ status: 1 });
});
ponder.on("AgreementRegistry:AgreementResolved", async ({ event, context }) => {
  await context.db
    .update(schema.agreement, { id: event.args.agreementId })
    .set({ status: 3, completedAt: event.block.timestamp });
});
ponder.on("AgreementRegistry:AgreementCompleted", async ({ event, context }) => {
  await context.db
    .update(schema.agreement, { id: event.args.agreementId })
    .set({ status: 4, completedAt: event.block.timestamp });
});
ponder.on("AgreementRegistry:AgreementTerminated", async ({ event, context }) => {
  await context.db
    .update(schema.agreement, { id: event.args.agreementId })
    .set({ status: 5, completedAt: event.block.timestamp });
});

// ---------- VaultManager ----------

ponder.on("VaultManager:VaultCreated", async ({ event, context }) => {
  await context.db.insert(schema.vault).values({
    id: event.args.vaultId,
    agreementId: event.args.agreementId,
    token: event.args.token,
    deposited: 0n,
    released: 0n,
    refunded: 0n,
    status: 0,
  });
  // Link for the AgreementCreated handler (fires later in the same tx).
  await context.db
    .insert(schema.agreementVault)
    .values({ id: event.args.agreementId, vaultId: event.args.vaultId });
});

ponder.on("VaultManager:FundsDeposited", async ({ event, context }) => {
  await context.db
    .update(schema.vault, { id: event.args.vaultId })
    .set((row) => ({ deposited: row.deposited + event.args.amount, status: 1 }));
  await context.db.insert(schema.payment).values({
    id: pid(event),
    vaultId: event.args.vaultId,
    kind: "deposit",
    account: null,
    token: null,
    amount: event.args.amount,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("VaultManager:PaymentReleased", async ({ event, context }) => {
  await context.db
    .update(schema.vault, { id: event.args.vaultId })
    .set((row) => ({ released: row.released + event.args.amount }));
  await context.db.insert(schema.payment).values({
    id: pid(event),
    vaultId: event.args.vaultId,
    kind: "release",
    account: event.args.recipient,
    token: null,
    amount: event.args.amount,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("VaultManager:RefundIssued", async ({ event, context }) => {
  await context.db
    .update(schema.vault, { id: event.args.vaultId })
    .set((row) => ({ refunded: row.refunded + event.args.amount }));
  await context.db.insert(schema.payment).values({
    id: pid(event),
    vaultId: event.args.vaultId,
    kind: "refund",
    account: event.args.recipient,
    token: null,
    amount: event.args.amount,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("VaultManager:FeeCollected", async ({ event, context }) => {
  await context.db.insert(schema.payment).values({
    id: pid(event),
    vaultId: event.args.vaultId,
    kind: "fee",
    account: event.args.treasury,
    token: null,
    amount: event.args.amount,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("VaultManager:Withdrawal", async ({ event, context }) => {
  await context.db.insert(schema.payment).values({
    id: pid(event),
    vaultId: null,
    kind: "withdrawal",
    account: event.args.recipient,
    token: event.args.token,
    amount: event.args.amount,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

// ---------- WorkUnitManager ----------

ponder.on("WorkUnitManager:WorkUnitCreated", async ({ event, context }) => {
  await context.db.insert(schema.workUnit).values({
    id: event.args.id,
    agreementId: event.args.agreementId,
    sequence: event.args.sequence,
    amount: event.args.amount,
    status: 1,
    submissionCID: null,
    createdAt: event.block.timestamp,
    submittedAt: null,
    approvedAt: null,
    settledAt: null,
  });
});

ponder.on("WorkUnitManager:WorkStarted", async ({ event, context }) => {
  await context.db.update(schema.workUnit, { id: event.args.id }).set({ status: 2 });
});
ponder.on("WorkUnitManager:WorkSubmitted", async ({ event, context }) => {
  await context.db
    .update(schema.workUnit, { id: event.args.id })
    .set({ status: 3, submissionCID: event.args.submissionCID, submittedAt: event.block.timestamp });
});
ponder.on("WorkUnitManager:RevisionRequested", async ({ event, context }) => {
  await context.db.update(schema.workUnit, { id: event.args.id }).set({ status: 4 });
});
ponder.on("WorkUnitManager:WorkApproved", async ({ event, context }) => {
  await context.db
    .update(schema.workUnit, { id: event.args.id })
    .set({ status: 5, approvedAt: event.block.timestamp });
});
ponder.on("WorkUnitManager:WorkSettled", async ({ event, context }) => {
  await context.db
    .update(schema.workUnit, { id: event.args.id })
    .set({ status: 6, settledAt: event.block.timestamp });
});
ponder.on("WorkUnitManager:WorkCancelled", async ({ event, context }) => {
  await context.db.update(schema.workUnit, { id: event.args.id }).set({ status: 7 });
});

// ---------- ReputationRegistry ----------

const ZERO_REP = {
  completedAsFreelancer: 0n,
  completedAsEmployer: 0n,
  volumeAsFreelancer: 0n,
  disputesAsFreelancer: 0n,
  disputesLostAsFreelancer: 0n,
  disputesAsEmployer: 0n,
  disputesLostAsEmployer: 0n,
};

ponder.on("ReputationRegistry:SettlementRecorded", async ({ event, context }) => {
  const { employerProfileId, freelancerProfileId, amount } = event.args;
  await context.db
    .insert(schema.reputation)
    .values({ ...ZERO_REP, id: freelancerProfileId, completedAsFreelancer: 1n, volumeAsFreelancer: amount })
    .onConflictDoUpdate((row) => ({
      completedAsFreelancer: row.completedAsFreelancer + 1n,
      volumeAsFreelancer: row.volumeAsFreelancer + amount,
    }));
  await context.db
    .insert(schema.reputation)
    .values({ ...ZERO_REP, id: employerProfileId, completedAsEmployer: 1n })
    .onConflictDoUpdate((row) => ({ completedAsEmployer: row.completedAsEmployer + 1n }));
});

ponder.on("ReputationRegistry:DisputeRecorded", async ({ event, context }) => {
  const { employerProfileId, freelancerProfileId, outcome } = event.args;
  const freelancerLost = outcome === 1 ? 1n : 0n; // EmployerPrevails
  const employerLost = outcome === 2 ? 1n : 0n; // FreelancerPrevails
  await context.db
    .insert(schema.reputation)
    .values({ ...ZERO_REP, id: freelancerProfileId, disputesAsFreelancer: 1n, disputesLostAsFreelancer: freelancerLost })
    .onConflictDoUpdate((row) => ({
      disputesAsFreelancer: row.disputesAsFreelancer + 1n,
      disputesLostAsFreelancer: row.disputesLostAsFreelancer + freelancerLost,
    }));
  await context.db
    .insert(schema.reputation)
    .values({ ...ZERO_REP, id: employerProfileId, disputesAsEmployer: 1n, disputesLostAsEmployer: employerLost })
    .onConflictDoUpdate((row) => ({
      disputesAsEmployer: row.disputesAsEmployer + 1n,
      disputesLostAsEmployer: row.disputesLostAsEmployer + employerLost,
    }));
});

// ---------- DisputeManager ----------

ponder.on("DisputeManager:DisputeOpened", async ({ event, context }) => {
  await context.db.insert(schema.dispute).values({
    id: event.args.disputeId,
    agreementId: event.args.agreementId,
    initiator: event.args.initiator,
    status: 1,
    outcome: null,
    createdAt: event.block.timestamp,
    resolvedAt: null,
  });
});

ponder.on("DisputeManager:ReviewBegun", async ({ event, context }) => {
  await context.db.update(schema.dispute, { id: event.args.disputeId }).set({ status: 2 });
});
ponder.on("DisputeManager:DisputeResolved", async ({ event, context }) => {
  await context.db
    .update(schema.dispute, { id: event.args.disputeId })
    .set({ status: 3, outcome: event.args.outcome, resolvedAt: event.block.timestamp });
});
ponder.on("DisputeManager:DisputeDismissed", async ({ event, context }) => {
  await context.db
    .update(schema.dispute, { id: event.args.disputeId })
    .set({ status: 4, resolvedAt: event.block.timestamp });
});
