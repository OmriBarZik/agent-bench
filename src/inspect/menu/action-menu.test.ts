import { expect, test } from "bun:test";
import type { RunChoice } from "../list/select-state.types";
import { applyMenuKey, backMenu, currentPage, openActionMenu } from "./action-menu";
import type { ActionMenu, MenuKeyResult } from "./action-menu.types";
import { actionMenuLines } from "./menu-lines";

const DOWN = "\x1b[B";
const UP = "\x1b[A";
const LEFT = "\x1b[D";
const RIGHT = "\x1b[C";

test("arrows move through the actions and stop at the ends", () => {
  const run = choice({ transcriptPath: "/runs/t.jsonl" });
  const opened = openActionMenu(run.runId);
  const down = stayed(applyMenuKey({ menu: opened, key: DOWN, choice: run }));
  const stuck = stayed(applyMenuKey({ menu: opened, key: UP, choice: run }));

  expect(currentPage(down).selected).toBe(1);
  expect(currentPage(stuck).selected).toBe(0);
});

test("enter runs a command and skips one the run can't use", () => {
  const withTranscript = choice({ transcriptPath: "/runs/t.jsonl" });
  const without = choice();
  const opened = openActionMenu(without.runId);

  expect(applyMenuKey({ menu: opened, key: "\r", choice: withTranscript })).toEqual({
    kind: "run",
    command: "transcript",
  });
  expect(applyMenuKey({ menu: opened, key: "\r", choice: without })).toEqual({ kind: "stay", menu: opened });
  expect(applyMenuKey({ menu: opened, key: "3", choice: without })).toEqual({ kind: "run", command: "decide" });
});

test("build opens a submenu that left arrow and backMenu step out of", () => {
  const run = choice();
  const build = stayed(applyMenuKey({ menu: openActionMenu(run.runId), key: "4", choice: run }));
  const remote = applyMenuKey({ menu: build, key: "2", choice: run });
  const local = applyMenuKey({ menu: build, key: RIGHT, choice: run });
  const back = stayed(applyMenuKey({ menu: build, key: LEFT, choice: run }));

  expect(currentPage(build).screen).toBe("build");
  expect(remote).toEqual({ kind: "run", command: "build-remote" });
  expect(local).toEqual({ kind: "run", command: "build-local" });
  expect(currentPage(back)).toEqual({ screen: "actions", selected: 3 });
  expect(backMenu(back)).toBeNull();
  expect(applyMenuKey({ menu: back, key: LEFT, choice: run })).toEqual({ kind: "close" });
});

test("remove asks first, and no goes back to the actions", () => {
  const run = choice();
  const confirm = stayed(applyMenuKey({ menu: openActionMenu(run.runId), key: "6", choice: run }));
  const keep = stayed(applyMenuKey({ menu: confirm, key: "\r", choice: run }));

  expect(currentPage(confirm)).toEqual({ screen: "remove", selected: 0 });
  expect(currentPage(keep).screen).toBe("actions");
  expect(applyMenuKey({ menu: confirm, key: "2", choice: run })).toEqual({ kind: "run", command: "remove" });
});

test("a missing branch greys out build and checkout with the reason", () => {
  const run = choice({ present: false });
  const lines = actionMenuLines({ menu: openActionMenu(run.runId), choice: run, height: 8, columns: 80 });
  const text = lines.join("\n");

  expect(lines).toHaveLength(8);
  expect(text).toContain("Actions for dino × haiku");
  expect(text).toContain("4  Build…");
  expect(text).toContain("(branch not in the checkout)");
  expect(text).toContain("^F");
  expect(lines[1]).toContain("\x1b[7m");
});

test("a short pane scrolls to keep the highlight visible", () => {
  const run = choice();
  const menu: ActionMenu = { runId: run.runId, pages: [{ screen: "actions", selected: 5 }] };
  const text = actionMenuLines({ menu, choice: run, height: 4, columns: 80 }).join("\n");

  expect(text).toContain("6  Remove from database…");
  expect(text).not.toContain("1  Open run transcript");
});

function stayed(result: MenuKeyResult): ActionMenu {
  if (result.kind !== "stay") {
    throw new Error(`expected the menu to stay open, got ${result.kind}`);
  }

  return result.menu;
}

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
    title: null,
    commitSha: null,
    changedFiles: [],
    artifactsPath: null,
    decision: null,
    score: null,
    success: null,
    judgeNote: null,
    successThreshold: null,
    judgeModel: null,
    judgeCostUsd: null,
    judgeDurationMs: null,
    judgeTurns: null,
    present: true,
    current: false,
    transcriptPath: null,
    judgeTranscriptPath: null,
    ...overrides,
  };
}
