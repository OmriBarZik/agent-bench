import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, startRun, upsertConfig, upsertTask } from "../../db/db";
import { BENCH_DIR } from "../../paths";
import { loadSetups } from "./load-setups";

test("a missing setup.json is undeclared and a stored run is counted", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setups-"));
  const dbPath = join(directory, "bench.sqlite");
  const db = openDb(dbPath);

  try {
    upsertTask({
      db,
      task: { taskId: "t1", prompt: "do the thing", judgePrompt: "score it", chromiumSha: "abc" },
    });
    upsertConfig({ db, config: { configId: "baseline", configHash: "hash" } });
    startRun({
      db,
      run: {
        runId: "run",
        taskId: "t1",
        configId: "baseline",
        repeat: 0,
        promptVersion: "p1",
        judgePromptVersion: "j1",
        claudeVersion: "test",
        model: "test",
        branch: "run",
      },
    });
  } finally {
    db.close();
  }

  try {
    const report = loadSetups({
      configs: [{ configId: "baseline", description: "plain" }, { configId: "not-real" }],
      dbPath,
    });

    expect(report.configs[0]).toMatchObject({ configId: "baseline", status: "ready", runs: 1, checks: [] });
    expect(report.configs[1]).toMatchObject({
      configId: "not-real",
      status: "undeclared",
      runs: 0,
      detail: join("configs/setup", "not-real", "setup.json"),
    });
    expect(report.shared.map((check) => check.label)).toEqual(["bun", "claude", "checkout"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("every shipped config declares a setup.json the tab can read", async () => {
  const configsPath = join(BENCH_DIR, "configs/benchmark-setup.json");
  const entries = (await Bun.file(configsPath).json()) as { configId: string; description?: string }[];
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setups-"));
  const dbPath = join(directory, "bench.sqlite");

  try {
    const report = loadSetups({
      configs: entries.map((entry) => ({ configId: entry.configId, description: entry.description })),
      dbPath,
    });

    expect(report.configs.map((config) => config.configId)).toEqual(entries.map((entry) => entry.configId));

    for (const config of report.configs) {
      expect(["ready", "missing"]).toContain(config.status);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
