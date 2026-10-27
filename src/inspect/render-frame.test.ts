import { expect, test } from "bun:test";
import { frameLayout, renderFrame } from "./render-frame";
import type { RunChoice, SelectState } from "./select-state.types";

test("frameLayout gives the detail pane a few rows under the list", () => {
  expect(frameLayout(24)).toEqual({ listHeight: 13, detailHeight: 8 });
});

test("renderFrame shows the run from the database and the files it changed", () => {
  const frame = renderFrame({
    choices: [choice()],
    state: { query: "", selected: 0, scroll: 0 },
    chromiumSrc: "/chromium/src",
    notice: "",
    rows: 24,
    columns: 100,
  });

  expect(frame).toContain("dino × haiku");
  expect(frame).toContain("Hat");
  expect(frame).toContain("partially-pass");
  expect(frame).toContain("success");
  expect(frame).toContain("most of the hat");
  expect(frame).toContain("judge claude-sonnet-5-5 · 12s · $0.041 · 4 turns");
  expect(frame).toContain("no run transcript · no judge transcript");
  expect(frame).toContain("→ judge");
  expect(frame).toContain("^B build");
  expect(frame).toContain("^X delete");
  expect(frame).toContain("chrome/foo.cc");
  expect(frame).toContain("/chromium/src");
});

test("renderFrame says when the filter matches nothing", () => {
  const state: SelectState = { query: "nope", selected: 0, scroll: 0 };
  const frame = renderFrame({
    choices: [choice()],
    state,
    chromiumSrc: "/chromium/src",
    notice: "",
    rows: 24,
    columns: 80,
  });

  expect(frame).toContain("no matching runs");
  expect(frame).toContain("filter: nope");
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
    judgeNote: "most of the hat",
    successThreshold: 0.8,
    judgeModel: "claude-sonnet-5-5",
    judgeCostUsd: 0.041,
    judgeDurationMs: 12_000,
    judgeTurns: 4,
    present: true,
    current: false,
    transcriptPath: null,
    judgeTranscriptPath: null,
    ...overrides,
  };
}
