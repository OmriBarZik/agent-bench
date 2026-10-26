import type { JudgeMetrics } from "../../db/db.types";
import { isJudgeBlockerKind } from "../../db/judge-blocker";
import type { JudgeBlocker } from "../../db/judge-blocker.types";

/** The blockers in a judge's structured output. Entries without a known kind are dropped. */
export function readBlockers(value: unknown): JudgeBlocker[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const blockers: JudgeBlocker[] = [];

  for (const entry of value) {
    const blocker = blockerFromUnknown(entry);

    if (blocker) {
      blockers.push(blocker);
    }
  }

  return blockers;
}

/** Lines the runner prints when a tool stopped the agent. Empty when nothing did. */
export function blockerAlert({ runId, judge }: { runId: string; judge: JudgeMetrics }): string[] {
  if (!judge.blocked) {
    return [];
  }

  const lines = [`  !! BLOCKED: ${runId} got stuck on a tool`];

  for (const blocker of judge.blockers) {
    lines.push(`     - ${blocker.kind} ${blocker.tool}: ${blocker.detail}`);
  }

  if (judge.blockers.length === 0) {
    lines.push("     - the judge gave no details; see the judge transcript");
  }

  return lines;
}

function blockerFromUnknown(value: unknown): JudgeBlocker | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { kind?: unknown; tool?: unknown; detail?: unknown };

  if (!isJudgeBlockerKind(record.kind)) {
    return null;
  }

  return {
    kind: record.kind,
    tool: typeof record.tool === "string" ? record.tool.trim() : "",
    detail: typeof record.detail === "string" ? record.detail.trim() : "",
  };
}
