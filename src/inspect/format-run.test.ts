import { expect, test } from "bun:test";
import { changedFileLine, choiceLabel } from "./format-run";
import type { RunChoice } from "./select-state.types";

test("choiceLabel shows when the run happened and how many files it changed", () => {
  const label = choiceLabel(choice());

  expect(label).toContain("2026-10-24 14:02");
  expect(label).toContain("done");
  expect(label).toContain("1 file");
  expect(label).toContain("dino × haiku");
});

test("choiceLabel marks a branch the checkout does not have", () => {
  expect(choiceLabel(choice({ present: false }))).toContain("missing");
});

test("changedFileLine keeps both paths of a rename", () => {
  expect(changedFileLine({ status: "R", path: "new.cc", previousPath: "old.cc" })).toBe("R old.cc -> new.cc");
});

function choice(overrides: Partial<RunChoice> = {}): RunChoice {
  return {
    runId: "dino__haiku__r0",
    taskId: "dino",
    configId: "haiku",
    repeat: 0,
    status: "done",
    startedAt: "2026-10-24T14:02:03.000Z",
    branch: "dino__haiku__r0",
    model: "claude-haiku-5-5",
    title: "Hat",
    commitSha: "abc123def456",
    changedFiles: [{ status: "M", path: "chrome/foo.cc" }],
    artifactsPath: null,
    present: true,
    current: false,
    transcriptPath: null,
    ...overrides,
  };
}
