import { expect, test } from "bun:test";
import type { RunChoice } from "../list/select-state.types";
import { changedFileLine, choiceLabel } from "./format-run";

test("choiceLabel shows when the run happened and how many files it changed", () => {
  const label = choiceLabel(choice());

  expect(label).toContain("2026-10-24 14:02");
  expect(label).toContain("done");
  expect(label).toContain("partially-pass");
  expect(label).toContain("dino × haiku");
});

test("choiceLabel shows a cancelled run in full", () => {
  expect(choiceLabel(choice({ status: "cancelled", decision: null, score: null, success: null }))).toContain(
    "cancelled",
  );
});

test("choiceLabel marks a run the judge did not decide", () => {
  expect(choiceLabel(choice({ decision: null, score: null, success: null }))).toContain("n/a");
});

test("choiceLabel marks a running run as pending until the judge finishes", () => {
  expect(choiceLabel(choice({ status: "running", decision: null, score: null, success: null }))).toContain("pending");
});

test("choiceLabel shows an older decimal when the run has no decision", () => {
  expect(choiceLabel(choice({ decision: null, score: 0.743, success: true }))).toContain("0.743");
});

test("choiceLabel marks a branch the checkout does not have", () => {
  expect(choiceLabel(choice({ present: false }))).toContain("missing");
});

test("choiceLabel marks when a Chromium.app is on disk for Open Chromium", () => {
  expect(choiceLabel(choice({ chromiumAppPath: "/builds/dino__haiku__r0/Chromium.app" }))).toContain("chrome");
  expect(choiceLabel(choice({ chromiumAppPath: null }))).toMatch(/—\s+dino × haiku/);
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
    decision: "partially-pass",
    score: null,
    success: true,
    judgeNote: null,
    successThreshold: 0.8,
    judgeModel: null,
    judgeCostUsd: null,
    judgeDurationMs: null,
    judgeTurns: null,
    present: true,
    current: false,
    transcriptPath: null,
    judgeTranscriptPath: null,
    chromiumAppPath: null,
    hasAppCopy: false,
    ...overrides,
  };
}
