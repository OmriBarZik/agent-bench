import type { JudgeCheckVerdict } from "../../../db/db.types";

/** The per-check verdicts in a judge's structured output. Entries without a check name or a pass / fail are dropped. */
export function readChecks(value: unknown): JudgeCheckVerdict[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const checks: JudgeCheckVerdict[] = [];

  for (const entry of value) {
    const check = checkFromUnknown(entry);

    if (check) {
      checks.push(check);
    }
  }

  return checks;
}

function checkFromUnknown(value: unknown): JudgeCheckVerdict | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { check?: unknown; verdict?: unknown; evidence?: unknown };

  if (typeof record.check !== "string" || (record.verdict !== "pass" && record.verdict !== "fail")) {
    return null;
  }

  return {
    check: record.check.trim(),
    verdict: record.verdict,
    evidence: typeof record.evidence === "string" ? record.evidence.trim() : "",
  };
}
