import { expect, test } from "bun:test";
import { refreshNotice, reselect } from "./refresh-list";
import { actionRuns, applyKey, buildTarget, clampSelection, matchingChoices } from "./select-state";
import type { RunChoice, SelectState } from "./select-state.types";

const idle: SelectState = { query: "", selected: 0, scroll: 0, marked: [] };

test("arrow keys move the highlight and stop at the ends", () => {
  const down = applyKey({ state: idle, key: "\x1b[B", matchCount: 3, pageSize: 5 });
  const up = applyKey({ state: down.state, key: "\x1b[A", matchCount: 3, pageSize: 5 });
  const stuck = applyKey({ state: idle, key: "\x1b[A", matchCount: 3, pageSize: 5 });

  expect(down.state.selected).toBe(1);
  expect(up.state.selected).toBe(0);
  expect(stuck.state.selected).toBe(0);
});

test("enter opens the menu, ctrl-o opens the run, ctrl-e opens the judge, and ctrl-g checks out", () => {
  const menu = applyKey({ state: idle, key: "\r", matchCount: 2, pageSize: 5 });
  const transcript = applyKey({ state: idle, key: "\x0f", matchCount: 2, pageSize: 5 });
  const judge = applyKey({ state: idle, key: "\x05", matchCount: 2, pageSize: 5 });
  const checkout = applyKey({ state: idle, key: "\x07", matchCount: 2, pageSize: 5 });
  const empty = applyKey({ state: idle, key: "\r", matchCount: 0, pageSize: 5 });
  const emptyJudge = applyKey({ state: idle, key: "\x05", matchCount: 0, pageSize: 5 });

  expect(menu.action).toBe("menu");
  expect(transcript.action).toBe("transcript");
  expect(judge.action).toBe("judge");
  expect(judge.state).toEqual(idle);
  expect(checkout.action).toBe("checkout");
  expect(empty.action).toBe("stay");
  expect(emptyJudge.action).toBe("stay");
});

test("ctrl-b asks where to build, and l or r chooses the machine", () => {
  const build = applyKey({ state: idle, key: "\x02", matchCount: 2, pageSize: 5 });
  const empty = applyKey({ state: idle, key: "\x02", matchCount: 0, pageSize: 5 });

  expect(build.action).toBe("build");
  expect(build.state).toEqual(idle);
  expect(empty.action).toBe("stay");
  expect(buildTarget("l")).toBe("local");
  expect(buildTarget("R")).toBe("remote");
  expect(buildTarget("q")).toBeNull();
});

test("ctrl-f opens the decision dialog unless the list is empty", () => {
  const decide = applyKey({ state: idle, key: "\x06", matchCount: 2, pageSize: 5 });
  const empty = applyKey({ state: idle, key: "\x06", matchCount: 0, pageSize: 5 });

  expect(decide.action).toBe("decide");
  expect(decide.state).toEqual(idle);
  expect(empty.action).toBe("stay");
});

test("ctrl-x deletes unless the list is empty", () => {
  const remove = applyKey({ state: idle, key: "\x18", matchCount: 2, pageSize: 5 });
  const empty = applyKey({ state: idle, key: "\x18", matchCount: 0, pageSize: 5 });

  expect(remove.action).toBe("delete");
  expect(remove.state).toEqual(idle);
  expect(empty.action).toBe("stay");
});

test("letters filter, including q, and ctrl-c quits", () => {
  const typed = applyKey({
    state: { query: "", selected: 4, scroll: 2, marked: [] },
    key: "q",
    matchCount: 10,
    pageSize: 5,
  });
  const quit = applyKey({ state: typed.state, key: "\x03", matchCount: 10, pageSize: 5 });

  expect(typed).toEqual({ state: { query: "q", selected: 0, scroll: 0, marked: [] }, action: "stay" });
  expect(quit.action).toBe("quit");
});

test("space checks the highlighted run, and typing keeps the checks", () => {
  const checked = applyKey({ state: idle, key: " ", matchCount: 2, pageSize: 5, highlightedRunId: "a" });
  const again = applyKey({ state: checked.state, key: " ", matchCount: 2, pageSize: 5, highlightedRunId: "b" });
  const typed = applyKey({ state: again.state, key: "z", matchCount: 2, pageSize: 5, highlightedRunId: "b" });
  const cleared = applyKey({ state: typed.state, key: " ", matchCount: 2, pageSize: 5, highlightedRunId: "a" });
  const empty = applyKey({ state: idle, key: " ", matchCount: 0, pageSize: 5, highlightedRunId: null });

  expect(checked.state.marked).toEqual(["a"]);
  expect(checked.state.selected).toBe(0);
  expect(again.state.marked).toEqual(["a", "b"]);
  expect(typed.state).toEqual({ query: "z", selected: 0, scroll: 0, marked: ["a", "b"] });
  expect(cleared.state.marked).toEqual(["b"]);
  expect(empty.state.marked).toEqual([]);
});

test("page down keeps the previous row on screen", () => {
  const paged = applyKey({ state: idle, key: "\x1b[6~", matchCount: 10, pageSize: 5 });

  expect(paged.state.selected).toBe(4);
});

test("backspace drops the last character", () => {
  const cleared = applyKey({
    state: { query: "ha", selected: 0, scroll: 0, marked: [] },
    key: "\x7f",
    matchCount: 1,
    pageSize: 5,
  });

  expect(cleared.state.query).toBe("h");
});

test("clampSelection keeps the highlight on screen", () => {
  const state = clampSelection({
    state: { query: "", selected: 9, scroll: 0, marked: ["a"] },
    matchCount: 10,
    pageSize: 4,
  });

  expect(state.selected).toBe(9);
  expect(state.scroll).toBe(6);
  expect(state.marked).toEqual(["a"]);
});

test("checked runs are the selection, in check order, and a refresh drops one that is gone", () => {
  const runs = [choice({ branch: "a" }), choice({ branch: "b" }), choice({ branch: "c" })];
  const none = actionRuns({ choices: runs, highlighted: runs[1], marked: [] });
  const marked = actionRuns({ choices: runs, highlighted: runs[0], marked: ["c", "a", "missing"] });
  const fresh = [choice({ branch: "a" }), choice({ branch: "b" })];
  const kept = reselect({
    state: { ...idle, marked: ["missing", "b"] },
    choices: fresh,
    highlightedRunId: "a",
    pageSize: 5,
  });

  expect(none.map((run) => run.runId)).toEqual(["b"]);
  expect(marked.map((run) => run.runId)).toEqual(["c", "a"]);
  expect(kept.marked).toEqual(["b"]);
});

test("matchingChoices finds a changed path and ignores case", () => {
  const choices = [
    choice({ branch: "one", changedFiles: [{ status: "M", path: "chrome/Foo.cc" }] }),
    choice({ branch: "two" }),
  ];
  const matches = matchingChoices({ choices, query: "foo.cc" });

  expect(matches.map((match) => match.branch)).toEqual(["one"]);
  expect(matchingChoices({ choices, query: "  " })).toEqual(choices);
});

test("a refresh keeps the highlight on the same run when new runs come in above it", () => {
  const fresh = [
    choice({ branch: "new__haiku__r0" }),
    choice({ branch: "a__haiku__r0" }),
    choice({ branch: "b__haiku__r0" }),
  ];
  const state = reselect({
    state: { ...idle, selected: 1 },
    choices: fresh,
    highlightedRunId: "b__haiku__r0",
    pageSize: 5,
  });
  const gone = reselect({
    state: { ...idle, selected: 4 },
    choices: fresh,
    highlightedRunId: "x__haiku__r0",
    pageSize: 5,
  });

  expect(state.selected).toBe(2);
  expect(gone.selected).toBe(2);
  expect(refreshNotice({ before: 2, after: 3 })).toBe("refreshed: 3 runs, 1 new");
  expect(refreshNotice({ before: 3, after: 3 })).toBe("refreshed: 3 runs, none new");
});

function choice(overrides: Partial<RunChoice> = {}): RunChoice {
  return {
    runId: overrides.branch ?? "dino__haiku__r0",
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

test("left and right arrows do nothing, and ctrl-r asks for a refresh even with no matches", () => {
  expect(applyKey({ state: idle, key: "\x1b[C", matchCount: 2, pageSize: 5 })).toEqual({ state: idle, action: "stay" });
  expect(applyKey({ state: idle, key: "\x1b[D", matchCount: 2, pageSize: 5 })).toEqual({ state: idle, action: "stay" });
  expect(applyKey({ state: idle, key: "\x12", matchCount: 0, pageSize: 5 }).action).toBe("refresh");
});
