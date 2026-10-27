import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  judgeOverrideNote,
  listRunBranches,
  openDb,
  overrideJudgeDecision,
  saveJudgeRun,
  startRun,
  upsertConfig,
  upsertTask,
} from "../../db/db";
import type { JudgeMetrics } from "../../db/db.types";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("overrideJudgeDecision replaces a pass and keeps the judge metrics", () => {
  const db = openDb(tempDb());

  try {
    seedRun(db);
    saveJudgeRun({ db, runId: "dino__haiku__r0", judge: passed });

    const reason = overrideJudgeDecision({ db, runId: "dino__haiku__r0", decision: "partially-failed" });
    const row = db
      .query(`SELECT decision, success, reason, model, cost_usd FROM judge_runs WHERE run_id = $runId`)
      .get({ runId: "dino__haiku__r0" }) as {
      decision: string;
      success: number;
      reason: string;
      model: string;
      cost_usd: number;
    };
    const listed = listRunBranches(db)[0];
    const again = overrideJudgeDecision({ db, runId: "dino__haiku__r0", decision: "pass" });

    expect(reason).toBe(`${judgeOverrideNote("partially-failed")} most of the hat`);
    expect(row.decision).toBe("partially-failed");
    expect(row.success).toBe(0);
    expect(row.reason).toBe(reason);
    expect(row.model).toBe("claude-sonnet-5-5");
    expect(row.cost_usd).toBeCloseTo(0.041);
    expect(listed?.decision).toBe("partially-failed");
    expect(listed?.success).toBe(false);
    expect(again).toBe(`${judgeOverrideNote("pass")} most of the hat`);
  } finally {
    db.close();
  }
});

test("overrideJudgeDecision records a decision when the run was never judged", () => {
  const db = openDb(tempDb());

  try {
    seedRun(db);

    expect(overrideJudgeDecision({ db, runId: "dino__haiku__r0", decision: "partially-pass" })).toBe(
      judgeOverrideNote("partially-pass"),
    );

    const row = db.query(`SELECT status, decision, success FROM judge_runs WHERE run_id = $runId`).get({
      runId: "dino__haiku__r0",
    }) as { status: string; decision: string; success: number };

    expect(row).toEqual({ status: "done", decision: "partially-pass", success: 1 });
  } finally {
    db.close();
  }
});

function tempDb(): string {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-"));
  directories.push(directory);

  return join(directory, "bench.sqlite");
}

function seedRun(db: ReturnType<typeof openDb>) {
  upsertTask({
    db,
    task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" },
  });
  upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
  startRun({
    db,
    run: {
      runId: "dino__haiku__r0",
      taskId: "dino",
      configId: "haiku",
      repeat: 0,
      promptVersion: "p1",
      judgePromptVersion: "j1",
      claudeVersion: "test",
      model: "claude-haiku-5-5",
      branch: "dino__haiku__r0",
    },
  });
}

const passed: JudgeMetrics = {
  model: "claude-sonnet-5-5",
  status: "done",
  durationMs: 12_000,
  numTurns: 4,
  costUsd: 0.041,
  inputTokens: 100,
  outputTokens: 20,
  cacheCreationTokens: 5,
  cacheReadTokens: 30,
  totalTokens: 155,
  decision: "pass",
  success: true,
  reason: "most of the hat",
  error: null,
  blocked: false,
  blockers: [],
};
