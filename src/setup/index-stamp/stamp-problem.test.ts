import { expect, test } from "bun:test";
import type { IndexStamp } from "./index-stamp.types";
import { parseStamp, stampProblem, treeProblem } from "./stamp-problem";

const TASK_SHA = "920e1e66e67c6038a08847aa817a771c5c180ed3";
const OTHER_SHA = "9b7c91dd7080bc4beac7a0a73d374a617b38efe6";

function stamp(overrides: Partial<IndexStamp>): IndexStamp {
  return { tool: "zoekt", checkout: "/src", sha: TASK_SHA, dirty: [], builtAt: "2026-11-26T00:00:00Z", ...overrides };
}

test("treeProblem allows a clean tree at the one task SHA", () => {
  expect(treeProblem({ tree: { sha: TASK_SHA, dirty: [] }, taskShas: [TASK_SHA] })).toBeUndefined();
});

test("treeProblem refuses another commit, a dirty tree, and tasks at several SHAs", () => {
  expect(treeProblem({ tree: { sha: OTHER_SHA, dirty: [] }, taskShas: [TASK_SHA] })).toContain("not the task SHA");
  expect(treeProblem({ tree: { sha: TASK_SHA, dirty: ["?? new.ts"] }, taskShas: [TASK_SHA] })).toContain("not clean");
  expect(treeProblem({ tree: { sha: TASK_SHA, dirty: [] }, taskShas: [TASK_SHA, OTHER_SHA] })).toContain(
    "2 chromiumSha",
  );
  expect(treeProblem({ tree: { sha: TASK_SHA, dirty: [] }, taskShas: [] })).toContain("0 chromiumSha");
});

test("stampProblem passes a clean stamp at the task SHA", () => {
  expect(stampProblem({ stamp: stamp({}), taskShas: [TASK_SHA] })).toBeUndefined();
});

test("stampProblem fails a dirty stamp and a stamp at another SHA", () => {
  expect(stampProblem({ stamp: stamp({ dirty: [" M trex.ts"] }), taskShas: [TASK_SHA] })).toContain("dirty");
  expect(stampProblem({ stamp: stamp({ sha: OTHER_SHA }), taskShas: [TASK_SHA] })).toContain("9b7c91dd7080");
  expect(stampProblem({ stamp: stamp({}), taskShas: [TASK_SHA, OTHER_SHA] })).toContain("9b7c91dd7080");
});

test("parseStamp reads a written stamp and rejects other text", () => {
  expect(parseStamp(JSON.stringify(stamp({})))).toEqual(stamp({}));
  expect(parseStamp("not json")).toBe("stamp is not JSON");
  expect(parseStamp(JSON.stringify({ sha: "abc", dirty: [] }))).toBe("stamp has no sha");
  expect(parseStamp(JSON.stringify({ sha: TASK_SHA }))).toBe("stamp has no dirty list");
});
