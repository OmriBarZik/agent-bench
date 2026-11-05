import { expect, test } from "bun:test";
import type { RunChoice, SelectState } from "../list/select-state.types";
import { frameLayout, renderFrame } from "./render-frame";

test("frameLayout gives the detail pane a few rows under the list", () => {
  expect(frameLayout(24)).toEqual({ listHeight: 13, detailHeight: 8 });
});

test("renderFrame shows the run from the database and the files it changed", () => {
  const frame = renderFrame({
    choices: [choice()],
    state: { query: "", selected: 0, scroll: 0, marked: [] },
    chromiumSrc: "/chromium/src",
    notice: "",
    decisionDialog: null,
    rows: 24,
    columns: 120,
  });

  expect(frame).toContain("dino × haiku");
  expect(frame).toContain("Hat");
  expect(frame).toContain("partially-pass");
  expect(frame).toContain("success");
  expect(frame).toContain("most of the hat");
  expect(frame).toContain("judge claude-sonnet-5-5 · 12s · $0.041 · 4 turns");
  expect(frame).toContain("no run transcript · no judge transcript");
  expect(frame).toContain("^E judge");
  expect(frame).toContain("^B build");
  expect(frame).toContain("^P chrome");
  expect(frame).toContain("^F decide");
  expect(frame).toContain("^X delete");
  expect(frame).toContain("^G checkout");
  expect(frame).toContain("chrome/foo.cc");
  expect(frame).toContain("/chromium/src");
});

test("renderFrame lists the four judge decisions while that dialog is open", () => {
  const frame = renderFrame({
    choices: [choice()],
    state: { query: "", selected: 0, scroll: 0, marked: [] },
    chromiumSrc: "/chromium/src",
    notice: "",
    decisionDialog: { runId: "dino__haiku__r0", selected: 0 },
    rows: 24,
    columns: 100,
  });

  expect(frame).toContain("1  failed");
  expect(frame).toContain("2  partially-failed");
  expect(frame).toContain("3  partially-pass");
  expect(frame).toContain("4  pass");
  expect(frame).toContain("esc cancels");
});

test("renderFrame says when the filter matches nothing", () => {
  const state: SelectState = { query: "nope", selected: 0, scroll: 0, marked: [] };
  const frame = renderFrame({
    choices: [choice()],
    state,
    chromiumSrc: "/chromium/src",
    notice: "",
    decisionDialog: null,
    rows: 24,
    columns: 80,
  });

  expect(frame).toContain("no matching runs");
  expect(frame).toContain("filter: nope");
});

test("renderFrame marks checked runs once one is selected", () => {
  const frame = renderFrame({
    choices: [choice(), choice({ runId: "dino__haiku__r1", branch: "dino__haiku__r1" })],
    state: { query: "", selected: 1, scroll: 0, marked: ["dino__haiku__r0"] },
    chromiumSrc: "/chromium/src",
    notice: "",
    decisionDialog: null,
    rows: 24,
    columns: 120,
  });

  expect(frame).toContain("[x] ");
  expect(frame).toContain("[ ] ");
  expect(frame).toContain("1 selected");
  expect(frame).toContain("space  enter menu");
});

test("renderFrame says when the database has no runs", () => {
  const frame = renderFrame({
    choices: [],
    state: { query: "", selected: 0, scroll: 0, marked: [] },
    chromiumSrc: "/chromium/src",
    notice: "",
    decisionDialog: null,
    rows: 24,
    columns: 80,
  });

  expect(frame).toContain("no runs in the database yet");
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
    chromiumAppPath: null,
    ...overrides,
  };
}
