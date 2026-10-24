import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteRun,
  finishRun,
  listRunBranches,
  logToolCall,
  openDb,
  saveJudgeRun,
  startRun,
  upsertConfig,
  upsertTask,
} from "./db";
import type { JudgeMetrics } from "./db.types";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempDb(): string {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-"));
  directories.push(directory);

  return join(directory, "bench.sqlite");
}

test("openDb adds the artifact columns to a database created before them", () => {
  const path = tempDb();
  const created = new Database(path);
  created.run(`CREATE TABLE runs (
    run_id TEXT PRIMARY KEY,
    task_id TEXT,
    config_id TEXT,
    repeat INTEGER,
    claude_version TEXT,
    model TEXT,
    machine TEXT,
    started_at TEXT,
    finished_at TEXT,
    status TEXT,
    duration_ms INTEGER,
    num_turns INTEGER,
    cost_usd REAL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    permission_denials INTEGER,
    success INTEGER,
    score REAL,
    score_details TEXT,
    raw_result TEXT,
    artifacts_path TEXT
  )`);
  created.close();

  const db = openDb(path);
  try {
    const names = (db.query("PRAGMA table_info(runs)").all() as { name: string }[]).map((row) => row.name);
    expect(names).toContain("branch");
    expect(names).toContain("commit_sha");
    expect(names).toContain("changed_files");
    expect(names).not.toContain("score");
    expect(names).not.toContain("success");
    expect(names).not.toContain("score_details");
    const tables = (db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (row) => row.name,
    );
    expect(tables).toContain("judge_runs");
  } finally {
    db.close();
  }
});

test("finishRun stores the branch commit and the files it changed", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({
      db,
      task: {
        taskId: "t1",
        prompt: "do the thing",
        judgePrompt: "score it",
        successThreshold: 0.8,
        chromiumSha: "abc",
      },
    });
    upsertConfig({ db, config: { configId: "baseline", configHash: "hash" } });
    const runId = "t1__baseline__r0__abc";
    startRun({
      db,
      run: {
        runId,
        taskId: "t1",
        configId: "baseline",
        repeat: 0,
        claudeVersion: "test",
        model: "test",
        branch: runId,
      },
    });
    finishRun({
      db,
      runId,
      result: { is_error: false },
      artifact: { commitSha: "def", changedFiles: [{ status: "M", path: "chrome/foo.cc" }] },
    });
    const row = db.query("SELECT branch, commit_sha, changed_files FROM runs WHERE run_id = $runId").get({ runId }) as {
      branch: string;
      commit_sha: string;
      changed_files: string;
    };

    expect(row.branch).toBe(runId);
    expect(row.commit_sha).toBe("def");
    expect(JSON.parse(row.changed_files)).toEqual([{ status: "M", path: "chrome/foo.cc" }]);
  } finally {
    db.close();
  }
});

test("listRunBranches returns newest runs and skips a corrupt file list", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({
      db,
      task: {
        taskId: "dino",
        prompt: "paint",
        judgePrompt: "score it",
        successThreshold: 0.8,
        chromiumSha: "abc",
        title: "Dino",
      },
    });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    seedRun({ db, runId: "older", startedAt: "2026-10-24T12:00:00.000Z" });
    seedRun({ db, runId: "newer", startedAt: "2026-10-24T14:00:00.000Z" });
    finishRun({
      db,
      runId: "newer",
      result: { is_error: false },
      artifact: { commitSha: "abc123", changedFiles: [{ status: "M", path: "chrome/foo.cc" }] },
    });
    seedRun({ db, runId: "skipped", startedAt: "2026-10-24T15:00:00.000Z" });
    db.query("UPDATE runs SET branch = NULL WHERE run_id = $runId").run({ runId: "skipped" });
    db.query("UPDATE runs SET changed_files = $changedFiles WHERE run_id = $runId").run({
      runId: "older",
      changedFiles: "{",
    });
    const rows = listRunBranches(db);

    expect(rows.map((row) => row.runId)).toEqual(["newer", "older"]);
    expect(rows[0]).toMatchObject({
      title: "Dino",
      taskId: "dino",
      configId: "haiku",
      status: "done",
      model: "claude-haiku-5-5",
      commitSha: "abc123",
      changedFiles: [{ status: "M", path: "chrome/foo.cc" }],
    });
    expect(rows[1]?.changedFiles).toEqual([]);
    expect(rows[0]?.score).toBeNull();
    expect(rows[0]?.success).toBeNull();
  } finally {
    db.close();
  }
});

test("saveJudgeRun keeps the judge metrics apart from the agent run", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({
      db,
      task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", successThreshold: 0.8, chromiumSha: "abc" },
    });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    const runId = "dino__haiku__r0";
    startRun({
      db,
      run: {
        runId,
        taskId: "dino",
        configId: "haiku",
        repeat: 0,
        claudeVersion: "test",
        model: "test",
        branch: runId,
      },
    });
    finishRun({ db, runId, result: { is_error: false, total_cost_usd: 1.5, duration_ms: 90_000, num_turns: 12 } });
    saveJudgeRun({ db, runId, judge: judged });
    const agent = db
      .query("SELECT cost_usd, duration_ms, num_turns FROM runs WHERE run_id = $runId")
      .get({ runId }) as {
      cost_usd: number;
      duration_ms: number;
      num_turns: number;
    };
    const judge = db
      .query(
        `SELECT model, status, cost_usd, duration_ms, num_turns, total_tokens, score, success,
                success_threshold, reason, error
         FROM judge_runs WHERE run_id = $runId`,
      )
      .get({ runId }) as {
      model: string;
      status: string;
      cost_usd: number;
      duration_ms: number;
      num_turns: number;
      total_tokens: number;
      score: number;
      success: number;
      success_threshold: number;
      reason: string;
      error: string | null;
    };

    expect(agent).toEqual({ cost_usd: 1.5, duration_ms: 90_000, num_turns: 12 });
    expect(judge.model).toBe("claude-sonnet-5-5");
    expect(judge.status).toBe("done");
    expect(judge.cost_usd).toBeCloseTo(0.041);
    expect(judge.duration_ms).toBe(12_000);
    expect(judge.num_turns).toBe(4);
    expect(judge.total_tokens).toBe(155);
    expect(judge.score).toBeCloseTo(0.743);
    expect(judge.success).toBe(1);
    expect(judge.success_threshold).toBe(0.7);
    expect(judge.reason).toBe("most of the hat");
    expect(judge.error).toBeNull();
    expect(listRunBranches(db)[0]).toMatchObject({
      score: judge.score,
      success: true,
      judgeNote: "most of the hat",
      successThreshold: 0.7,
      judgeModel: "claude-sonnet-5-5",
      judgeCostUsd: judge.cost_usd,
      judgeDurationMs: 12_000,
      judgeTurns: 4,
    });
  } finally {
    db.close();
  }
});

test("deleteRun removes the run, its judge, and its tool calls", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({
      db,
      task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", successThreshold: 0.8, chromiumSha: "abc" },
    });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    const runId = "dino__haiku__r0";
    const keptId = "dino__haiku__r1";
    startRun({
      db,
      run: { runId, taskId: "dino", configId: "haiku", repeat: 0, claudeVersion: "test", model: "test", branch: runId },
    });
    startRun({
      db,
      run: {
        runId: keptId,
        taskId: "dino",
        configId: "haiku",
        repeat: 1,
        claudeVersion: "test",
        model: "test",
        branch: keptId,
      },
    });
    saveJudgeRun({ db, runId, judge: judged });
    logToolCall({ db, call: { runId, phase: "pre", tool: "Bash", command: "ls" } });
    deleteRun({ db, runId });

    expect(db.query(`SELECT run_id FROM runs WHERE run_id = $runId`).get({ runId })).toBeNull();
    expect(db.query(`SELECT run_id FROM judge_runs WHERE run_id = $runId`).get({ runId })).toBeNull();
    expect(db.query(`SELECT run_id FROM tool_calls WHERE run_id = $runId`).get({ runId })).toBeNull();
    expect(listRunBranches(db).map((row) => row.runId)).toEqual([keptId]);
    expect(db.query(`SELECT task_id FROM tasks WHERE task_id = $taskId`).get({ taskId: "dino" })).not.toBeNull();
  } finally {
    db.close();
  }
});

test("openDb adds judge_prompt to a tasks table created before it", () => {
  const path = tempDb();
  const created = new Database(path);
  created.run(`CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    title TEXT,
    difficulty TEXT,
    prompt TEXT NOT NULL,
    chromium_sha TEXT NOT NULL,
    scoring TEXT
  )`);
  created.close();

  const db = openDb(path);
  try {
    const names = (db.query("PRAGMA table_info(tasks)").all() as { name: string }[]).map((row) => row.name);
    expect(names).toContain("judge_prompt");
    expect(names).toContain("success_threshold");
  } finally {
    db.close();
  }
});

const judged: JudgeMetrics = {
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
  successThreshold: 0.7,
  score: 0.743,
  success: true,
  reason: "most of the hat",
  error: null,
};

function seedRun({ db, runId, startedAt }: { db: Database; runId: string; startedAt: string }) {
  startRun({
    db,
    run: {
      runId,
      taskId: "dino",
      configId: "haiku",
      repeat: 0,
      claudeVersion: "test",
      model: "claude-haiku-5-5",
      branch: runId,
    },
  });
  db.query("UPDATE runs SET started_at = $startedAt WHERE run_id = $runId").run({ runId, startedAt });
}
