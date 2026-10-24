import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finishRun, listRunBranches, openDb, startRun, upsertConfig, upsertTask } from "./db";

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
  } finally {
    db.close();
  }
});

test("finishRun stores the branch commit and the files it changed", () => {
  const db = openDb(tempDb());
  try {
    upsertTask({ db, task: { taskId: "t1", prompt: "do the thing", chromiumSha: "abc" } });
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
    upsertTask({ db, task: { taskId: "dino", prompt: "paint", chromiumSha: "abc", title: "Dino" } });
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
  } finally {
    db.close();
  }
});

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
