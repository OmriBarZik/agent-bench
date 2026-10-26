import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cancelRun,
  deleteRun,
  finishRun,
  listRunBranches,
  listToolTrouble,
  logToolCall,
  openDb,
  promptVersion,
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
        promptVersion: "p1",
        judgePromptVersion: "j1",
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

test("finishRun stores a cancelled run with the usage already reported", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({
      db,
      task: {
        taskId: "t1",
        prompt: "do the thing",
        judgePrompt: "score it",
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
        promptVersion: "p1",
        judgePromptVersion: "j1",
        claudeVersion: "test",
        model: "test",
        branch: runId,
      },
    });
    finishRun({
      db,
      runId,
      status: "cancelled",
      result: {
        is_error: true,
        error: "cancelled",
        duration_ms: 12_000,
        num_turns: 3,
        total_cost_usd: 0.25,
        usage: { input_tokens: 10, output_tokens: 4 },
        permission_denials: [],
      },
      artifact: { commitSha: null, changedFiles: [] },
    });
    const row = db
      .query(
        `SELECT status, finished_at, duration_ms, num_turns, cost_usd, input_tokens, output_tokens,
                total_tokens, permission_denials, changed_files, raw_result
         FROM runs WHERE run_id = $runId`,
      )
      .get({ runId }) as {
      status: string;
      finished_at: string;
      duration_ms: number;
      num_turns: number;
      cost_usd: number;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      permission_denials: number;
      changed_files: string;
      raw_result: string;
    };

    expect(row.status).toBe("cancelled");
    expect(row.finished_at).not.toBeNull();
    expect(row.duration_ms).toBe(12_000);
    expect(row.num_turns).toBe(3);
    expect(row.cost_usd).toBe(0.25);
    expect(row.input_tokens).toBe(10);
    expect(row.output_tokens).toBe(4);
    expect(row.total_tokens).toBe(14);
    expect(row.permission_denials).toBe(0);
    expect(JSON.parse(row.changed_files)).toEqual([]);
    expect(JSON.parse(row.raw_result).error).toBe("cancelled");
  } finally {
    db.close();
  }
});

test("cancelRun marks a finished run cancelled without clearing its metrics", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({
      db,
      task: {
        taskId: "t1",
        prompt: "do the thing",
        judgePrompt: "score it",
        chromiumSha: "abc",
      },
    });
    upsertConfig({ db, config: { configId: "baseline", configHash: "hash" } });
    const runId = "t1__baseline__r0__done";
    startRun({
      db,
      run: {
        runId,
        taskId: "t1",
        configId: "baseline",
        repeat: 0,
        promptVersion: "p1",
        judgePromptVersion: "j1",
        claudeVersion: "test",
        model: "test",
        branch: runId,
      },
    });
    finishRun({ db, runId, result: { is_error: false, total_cost_usd: 1.5, duration_ms: 90_000, num_turns: 12 } });
    cancelRun({ db, runId });
    const row = db
      .query("SELECT status, cost_usd, duration_ms, num_turns, finished_at FROM runs WHERE run_id = $runId")
      .get({
        runId,
      }) as {
      status: string;
      cost_usd: number;
      duration_ms: number;
      num_turns: number;
      finished_at: string;
    };

    expect(row.status).toBe("cancelled");
    expect(row.cost_usd).toBe(1.5);
    expect(row.duration_ms).toBe(90_000);
    expect(row.num_turns).toBe(12);
    expect(row.finished_at).not.toBeNull();
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
      task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" },
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
        promptVersion: "p1",
        judgePromptVersion: "j1",
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
        `SELECT model, status, cost_usd, duration_ms, num_turns, total_tokens, decision, score, success,
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
      decision: string;
      score: number | null;
      success: number;
      success_threshold: number | null;
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
    expect(judge.decision).toBe("partially-pass");
    expect(judge.score).toBeNull();
    expect(judge.success).toBe(1);
    expect(judge.success_threshold).toBeNull();
    expect(judge.reason).toBe("most of the hat");
    expect(judge.error).toBeNull();
    expect(listRunBranches(db)[0]).toMatchObject({
      decision: "partially-pass",
      score: null,
      success: true,
      judgeNote: "most of the hat",
      successThreshold: null,
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
      task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" },
    });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    const runId = "dino__haiku__r0";
    const keptId = "dino__haiku__r1";
    startRun({
      db,
      run: {
        runId,
        taskId: "dino",
        configId: "haiku",
        repeat: 0,
        promptVersion: "p1",
        judgePromptVersion: "j1",
        claudeVersion: "test",
        model: "test",
        branch: runId,
      },
    });
    startRun({
      db,
      run: {
        runId: keptId,
        taskId: "dino",
        configId: "haiku",
        repeat: 1,
        promptVersion: "p1",
        judgePromptVersion: "j1",
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

test("upsertTask stores a prompt version that changes only with the prompt text", () => {
  const db = openDb(tempDb());
  try {
    const readVersions = () =>
      db.query("SELECT prompt_version, judge_prompt_version FROM tasks WHERE task_id = 'dino'").get() as {
        prompt_version: string;
        judge_prompt_version: string;
      };
    upsertTask({ db, task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" } });
    const first = readVersions();
    upsertTask({ db, task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "def" } });
    const unchanged = readVersions();
    upsertTask({ db, task: { taskId: "dino", prompt: "paint a hat", judgePrompt: "score it", chromiumSha: "def" } });
    const edited = readVersions();

    expect(first).toEqual({ prompt_version: promptVersion("paint"), judge_prompt_version: promptVersion("score it") });
    expect(first.prompt_version).toMatch(/^[0-9a-f]{8}$/);
    expect(unchanged).toEqual(first);
    expect(edited.prompt_version).not.toBe(first.prompt_version);
    expect(edited.judge_prompt_version).toBe(first.judge_prompt_version);
  } finally {
    db.close();
  }
});

test("startRun stores the prompt versions the run was given", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({ db, task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" } });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    seedRun({ db, runId: "dino__haiku__r0", startedAt: "2026-10-24T12:00:00.000Z" });
    const row = db
      .query("SELECT prompt_version, judge_prompt_version FROM runs WHERE run_id = 'dino__haiku__r0'")
      .get();

    expect(row).toEqual({ prompt_version: "p1", judge_prompt_version: "j1" });
  } finally {
    db.close();
  }
});

test("openDb adds and backfills the prompt versions on tasks stored before them", () => {
  const path = tempDb();
  const created = new Database(path);
  created.run(`CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    title TEXT,
    difficulty TEXT,
    prompt TEXT NOT NULL,
    judge_prompt TEXT,
    chromium_sha TEXT NOT NULL,
    scoring TEXT
  )`);
  created.run(`INSERT INTO tasks (task_id, prompt, judge_prompt, chromium_sha) VALUES ('dino', 'paint', NULL, 'abc')`);
  created.close();

  const db = openDb(path);
  try {
    const row = db.query("SELECT prompt_version, judge_prompt_version FROM tasks WHERE task_id = 'dino'").get();
    const runColumns = (db.query("PRAGMA table_info(runs)").all() as { name: string }[]).map((column) => column.name);

    expect(row).toEqual({ prompt_version: promptVersion("paint"), judge_prompt_version: null });
    expect(runColumns).toContain("prompt_version");
    expect(runColumns).toContain("judge_prompt_version");
  } finally {
    db.close();
  }
});

test("openDb adds decision to a judge_runs table created before it", () => {
  const path = tempDb();
  const created = new Database(path);
  created.run(`CREATE TABLE judge_runs (
    run_id TEXT PRIMARY KEY,
    model TEXT,
    score REAL,
    success INTEGER
  )`);
  created.close();

  const db = openDb(path);
  try {
    const names = (db.query("PRAGMA table_info(judge_runs)").all() as { name: string }[]).map((row) => row.name);
    expect(names).toContain("decision");
    expect(names).toContain("blocked");
    expect(names).toContain("blockers");
  } finally {
    db.close();
  }
});

test("saveJudgeRun stores the blockers as JSON", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({ db, task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" } });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    seedRun({ db, runId: "dino__haiku__r0", startedAt: "2026-10-24T12:00:00.000Z" });
    const blockers = [{ kind: "missing-tool" as const, tool: "Bash: autoninja", detail: "not installed" }];
    saveJudgeRun({ db, runId: "dino__haiku__r0", judge: { ...judged, blocked: true, blockers } });
    const row = db.query("SELECT blocked, blockers FROM judge_runs WHERE run_id = 'dino__haiku__r0'").get() as {
      blocked: number;
      blockers: string;
    };

    expect(row.blocked).toBe(1);
    expect(JSON.parse(row.blockers)).toEqual(blockers);
  } finally {
    db.close();
  }
});

test("listToolTrouble lists each blocked or failed call once, oldest first", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({ db, task: { taskId: "dino", prompt: "paint", judgePrompt: "score it", chromiumSha: "abc" } });
    upsertConfig({ db, config: { configId: "haiku", configHash: "hash" } });
    const runId = "dino__haiku__r0";
    seedRun({ db, runId, startedAt: "2026-10-24T12:00:00.000Z" });
    const command = "cd src && rg hat | head";
    logToolCall({ db, call: { runId, phase: "pre", toolUseId: "denied", tool: "Bash", program: "cd", command } });
    logToolCall({ db, call: { runId, phase: "pre", toolUseId: "denied", tool: "Bash", program: "rg", command } });
    logToolCall({ db, call: { runId, phase: "pre", toolUseId: "ok", tool: "Read" } });
    logToolCall({ db, call: { runId, phase: "post", toolUseId: "ok", tool: "Read", isError: false } });
    logToolCall({ db, call: { runId, phase: "pre", toolUseId: "broken", tool: "Bash", command: "autoninja" } });
    logToolCall({
      db,
      call: { runId, phase: "post", toolUseId: "broken", tool: "Bash", isError: true, responsePreview: "not found" },
    });

    expect(listToolTrouble({ db, runId })).toEqual([
      { tool: "Bash", command, ran: false, responsePreview: null },
      { tool: "Bash", command: "autoninja", ran: true, responsePreview: "not found" },
    ]);
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
  decision: "partially-pass",
  success: true,
  reason: "most of the hat",
  error: null,
  blocked: false,
  blockers: [],
};

function seedRun({ db, runId, startedAt }: { db: Database; runId: string; startedAt: string }) {
  startRun({
    db,
    run: {
      runId,
      taskId: "dino",
      configId: "haiku",
      repeat: 0,
      promptVersion: "p1",
      judgePromptVersion: "j1",
      claudeVersion: "test",
      model: "claude-haiku-5-5",
      branch: runId,
    },
  });
  db.query("UPDATE runs SET started_at = $startedAt WHERE run_id = $runId").run({ runId, startedAt });
}
