import { expect, test } from "bun:test";
import type { AgentBuildView } from "../../db/db.types";
import { appendLogText, createLogCursor } from "./log-cursor";
import { createLogView } from "./log-view";
import { renderBuildLog } from "./render-build-log";

const building: AgentBuildView = {
  id: 4,
  run_id: "dino__haiku__r0",
  build_number: 2,
  status: "building",
  log_path: "/logs/build-2.log",
  started_at: "2026-11-07T12:00:00.000Z",
  task_id: "dino",
  config_id: "haiku",
  repeat: 0,
};

test("the frame shows the build, the tail, and the waiting state", () => {
  const cursor = appendLogText({ cursor: createLogCursor(), text: "send\nbuild\ncopy\n", maxLines: 10 });
  const frame = renderBuildLog({
    build: building,
    cursor,
    above: 0,
    rows: 6,
    columns: 80,
    chrome: "run",
  });
  const waiting = renderBuildLog({
    build: null,
    cursor: createLogView().cursor,
    above: 0,
    rows: 6,
    columns: 80,
    chrome: "tab",
  });

  expect(frame).toContain("Build 2 · building · dino × haiku r0");
  expect(frame).toContain("copy");
  expect(frame).toContain("ctrl-c stops the run");
  expect(waiting).toContain("Waiting for an agent to request a remote build.");
  expect(waiting).toContain("esc list");
  expect(waiting).toContain("tab switches");

  const paused = renderBuildLog({
    build: building,
    cursor,
    above: 0,
    rows: 6,
    columns: 80,
    chrome: "run",
    agentPaused: true,
  });

  expect(paused).toContain("agent paused");
  expect(paused).toContain("Agent paused until this build finishes.");
});

test("the footer says live at the tail and warns about new lines when scrolled up", () => {
  const cursor = appendLogText({ cursor: createLogCursor(), text: "a\nb\nc\nd\n", maxLines: 10 });
  const live = renderBuildLog({ build: building, cursor, above: 0, rows: 6, columns: 120, chrome: "tab" });
  const scrolled = renderBuildLog({
    build: building,
    cursor,
    above: 2,
    unseen: 3,
    rows: 6,
    columns: 120,
    chrome: "tab",
  });

  expect(live).toContain("● LIVE");
  expect(live).toContain("4 lines");
  expect(scrolled).toContain("▲ PAUSED 2 lines up · 3 new lines");
  expect(scrolled).toContain("end jumps to live");
});
