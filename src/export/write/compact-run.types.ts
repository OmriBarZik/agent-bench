import type { TimelineRecord } from "../run-records.types";

/** Builds in one run: how many, how they ended, and which step failed. */
export type CompactBuilds = {
  count: number;
  statuses: string[];
  failedSteps: string[];
};

/** Tool calls in one run: the most used tools with counts, and how many were denied or failed. */
export type CompactTools = {
  top: string[];
  notRan: number;
  failed: number;
};

/** A smaller run record for the one-file bundle; runs.jsonl keeps the full one. */
export type CompactRun = {
  runId: string;
  taskId: string;
  configId: string;
  repeat: number;
  promptVersion: string | null;
  status: string | null;
  timeline: TimelineRecord;
  model: string | null;
  minutes: number | null;
  turns: number | null;
  costUsd: number | null;
  totalTokens: number | null;
  validationShare: number | null;
  decision: string | null;
  success: boolean | null;
  judgeReason: string | null;
  blockers: unknown;
  benchChecks: string[] | null;
  changedFiles: number;
  builds: CompactBuilds;
  tools: CompactTools;
  agentSummary: string | null;
};
