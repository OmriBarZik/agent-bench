import { expect, test } from "bun:test";
import { planRuns } from "./matrix-plan";

test("planRuns fills each cell round by round and skips runs the DB already has", () => {
  const planned = planRuns({
    taskIds: ["hat", "ai"],
    configIds: ["baseline", "zoekt"],
    repeats: 2,
    counts: [
      { taskId: "hat", configId: "baseline", runs: 2 },
      { taskId: "ai", configId: "zoekt", runs: 1 },
    ],
  });

  expect(planned.map((run) => `${run.taskId}/${run.configId}#${run.repeat}`)).toEqual([
    "hat/zoekt#1",
    "ai/baseline#1",
    "hat/zoekt#2",
    "ai/baseline#2",
    "ai/zoekt#2",
  ]);
});
