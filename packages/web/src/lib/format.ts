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
  None: "none",
  Open: "open",
  Filled: "filled",
  Completed: "completed",
  Cancelled: "cancelled",
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

/** Compact relative time from a unix-seconds timestamp, e.g. "3h ago". */
export function timeAgo(ts: bigint | number): string {
  const s = Math.floor(Date.now() / 1000) - Number(ts);
  if (s < 45) return "just now";
  const units: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [secs, label] of units) {
    if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  }
  return `${s}s ago`;
}

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