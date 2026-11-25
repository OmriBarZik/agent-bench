import { describe, expect, test } from "bun:test";
import type { RunVersions } from "../db/db.types";
import { staleRunIds } from "./stale-runs";
import type { CurrentSetup } from "./stale-runs.types";

const CURRENT = [{ taskId: "hat", promptVersion: "p1", judgePromptVersion: "j1" }];

const SETUPS: CurrentSetup[] = [
  { taskId: "hat", configId: "rg", autoReview: true, configHash: "c1", setupHash: "s1" },
  { taskId: "hat", configId: "rg", autoReview: false, configHash: "c1", setupHash: "s0" },
];

function run(overrides: Partial<RunVersions>): RunVersions {
  return {
    runId: "run",
    taskId: "hat",
    configId: "rg",
    promptVersion: "p1",
    judgePromptVersion: "j1",
    autoReview: 1,
    configHash: null,
    setupHash: "s1",
    batch: null,
    ...overrides,
  };
}

describe("staleRunIds", () => {
  test("keeps a run whose prompts and setup match", () => {
    expect(staleRunIds({ runs: [run({})], current: CURRENT, setups: SETUPS }).runIds).toEqual([]);
  });

  test("archives an old setup hash or config hash", () => {
    const runs = [run({ runId: "setup", setupHash: "old" }), run({ runId: "config", configHash: "old" })];

    expect(staleRunIds({ runs, current: CURRENT, setups: SETUPS }).runIds).toEqual(["setup", "config"]);
  });

  test("compares against the setup with the run's auto review", () => {
    const runs = [run({ autoReview: 0, setupHash: "s0" })];

    expect(staleRunIds({ runs, current: CURRENT, setups: SETUPS }).runIds).toEqual([]);
  });

  test("leaves alone hashes it never recorded, configs that are gone, and archived runs", () => {
    const runs = [
      run({ runId: "none", setupHash: null }),
      run({ runId: "gone", configId: "removed", setupHash: "old" }),
      run({ runId: "archived", setupHash: "old", batch: "pilot" }),
    ];

    expect(staleRunIds({ runs, current: CURRENT, setups: SETUPS }).runIds).toEqual([]);
  });

  test("still archives an old prompt", () => {
    const runs = [run({ promptVersion: "p0" })];

    expect(staleRunIds({ runs, current: CURRENT, setups: SETUPS }).runIds).toHaveLength(1);
  });
});
