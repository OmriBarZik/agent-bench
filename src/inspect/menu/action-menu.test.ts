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
  const opened = openActionMenu([run.runId]);
  const down = stayed(applyMenuKey({ menu: opened, key: DOWN, choices: [run] }));
  const stuck = stayed(applyMenuKey({ menu: opened, key: UP, choices: [run] }));

  expect(currentPage(down).selected).toBe(1);
  expect(currentPage(stuck).selected).toBe(0);
});

test("enter runs a command and skips one the run can't use", () => {
  const withTranscript = choice({ transcriptPath: "/runs/t.jsonl" });
  const without = choice();
  const opened = openActionMenu([without.runId]);

  expect(applyMenuKey({ menu: opened, key: "\r", choices: [withTranscript] })).toEqual({
    kind: "run",
    command: "transcript",
  });
  expect(applyMenuKey({ menu: opened, key: "\r", choices: [without] })).toEqual({ kind: "stay", menu: opened });
  expect(applyMenuKey({ menu: opened, key: "3", choices: [without] })).toEqual({ kind: "run", command: "decide" });
});

test("build opens a submenu that backMenu steps out of, and left and right arrows do nothing", () => {
  const run = choice();
  const build = stayed(applyMenuKey({ menu: openActionMenu([run.runId]), key: "4", choices: [run] }));
  const remote = applyMenuKey({ menu: build, key: "2", choices: [run] });
  const local = applyMenuKey({ menu: build, key: "\r", choices: [run] });
  const back = backMenu(build);

  expect(currentPage(build).screen).toBe("build");
  expect(remote).toEqual({ kind: "run", command: "build-remote" });
  expect(local).toEqual({ kind: "run", command: "build-local" });
  expect(back && currentPage(back)).toEqual({ screen: "actions", selected: 3 });
  expect(back && backMenu(back)).toBeNull();
  expect(applyMenuKey({ menu: build, key: LEFT, choices: [run] })).toEqual({ kind: "stay", menu: build });
  expect(applyMenuKey({ menu: build, key: RIGHT, choices: [run] })).toEqual({ kind: "stay", menu: build });
});

test("open chromium runs when an app is on disk and stays put when the run was not built", () => {
  const built = choice({ chromiumAppPath: "/builds/dino__haiku__r0/Chromium.app" });
  const missing = choice();
  const opened = openActionMenu([built.runId]);
  const missingText = actionMenuLines({ menu: opened, choices: [missing], height: 12, columns: 80 }).join("\n");
  const builtText = actionMenuLines({ menu: opened, choices: [built], height: 12, columns: 80 }).join("\n");

  expect(applyMenuKey({ menu: opened, key: "5", choices: [built] })).toEqual({ kind: "run", command: "open-chromium" });
  expect(applyMenuKey({ menu: opened, key: "5", choices: [missing] })).toEqual({ kind: "stay", menu: opened });
  expect(missingText).toContain("5  Open Chromium");
  expect(missingText).toContain("(not built)");
  expect(builtText).toContain("^P");
});

test("remove asks first, and no goes back to the actions", () => {
  const run = choice();
  const confirm = stayed(applyMenuKey({ menu: openActionMenu([run.runId]), key: "7", choices: [run] }));
  const keep = stayed(applyMenuKey({ menu: confirm, key: "\r", choices: [run] }));

  expect(currentPage(confirm)).toEqual({ screen: "remove", selected: 0 });
  expect(currentPage(keep).screen).toBe("actions");
  expect(applyMenuKey({ menu: confirm, key: "2", choices: [run] })).toEqual({ kind: "run", command: "remove" });
});

test("a missing branch greys out build and checkout with the reason", () => {
  const run = choice({ present: false });
  const lines = actionMenuLines({ menu: openActionMenu([run.runId]), choices: [run], height: 8, columns: 80 });
  const text = lines.join("\n");

  expect(lines).toHaveLength(8);
  expect(text).toContain("Actions for dino × haiku");
  expect(text).toContain("4  Build…");
  expect(text).toContain("(branch not in the checkout)");
  expect(text).toContain("^F");
  expect(lines[1]).toContain("\x1b[7m");
});

test("several checked runs narrow the menu to the queue", () => {
  const first = choice();
  const second = choice({ runId: "dino__haiku__r1", branch: "dino__haiku__r1" });
  const menu = openActionMenu([first.runId, second.runId]);
  const text = actionMenuLines({ menu, choices: [first, second], height: 8, columns: 80 }).join("\n");
  const missing = [
    choice({ present: false }),
    choice({ runId: "dino__haiku__r1", branch: "dino__haiku__r1", present: false }),
  ];

  expect(text).toContain("Actions for 2 runs");
  expect(text).toContain("1  Queue on the build Mac");
  expect(text).not.toContain("Open run transcript");
  expect(applyMenuKey({ menu, key: "1", choices: [first, second] })).toEqual({ kind: "run", command: "build-remote" });
  expect(applyMenuKey({ menu, key: "\r", choices: missing })).toEqual({ kind: "stay", menu });
});

test("a short pane scrolls to keep the highlight visible", () => {
  const run = choice();
  const menu: ActionMenu = { runIds: [run.runId], pages: [{ screen: "actions", selected: 6 }] };
  const text = actionMenuLines({ menu, choices: [run], height: 4, columns: 80 }).join("\n");

  expect(text).toContain("7  Remove from database…");
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
    chromiumAppPath: null,
    ...overrides,
  };
}
