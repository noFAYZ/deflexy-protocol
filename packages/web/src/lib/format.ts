import type { Address, Hex } from "viem";
import type { BadgeProps } from "@/components/ui/badge";

export const MODELS = [
  "Fixed",
  "Milestone",
] as const;

export type Model = (typeof MODELS)[number];

export const JOB_STATUS = [
  "None",
  "Open",
  "Filled",
  "Completed",
  "Cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUS)[number];

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const STATUS_VARIANTS: Record<JobStatus, BadgeVariant> = {
  None: "subtle",
  Open: "lime",
  Filled: "info",
  Completed: "purple",
  Cancelled: "danger",
};

export function jobStatusVariant(status: number): BadgeVariant {
  return STATUS_VARIANTS[JOB_STATUS[status] ?? "None"];
}

export function jobStatusLabel(status: number): JobStatus {
  return JOB_STATUS[status] ?? "None";
}

export function modelLabel(model: number): Model {
  return MODELS[model] ?? MODELS[0];
}

export const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

export interface JobItem {
  id: bigint;
  employerProfileId: bigint;
  paymentToken: Address;
  budget: bigint;
  model: number;
  status: number;
  metadataCID: Hex;
  createdAt: bigint;
}