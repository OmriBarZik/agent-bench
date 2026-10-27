import { expect, test } from "bun:test";
import { applyKey, buildTarget, clampSelection, matchingChoices } from "./select-state";
import type { RunChoice, SelectState } from "./select-state.types";

const idle: SelectState = { query: "", selected: 0, scroll: 0 };

test("arrow keys move the highlight and stop at the ends", () => {
  const down = applyKey({ state: idle, key: "\x1b[B", matchCount: 3, pageSize: 5 });
  const up = applyKey({ state: down.state, key: "\x1b[A", matchCount: 3, pageSize: 5 });
  const stuck = applyKey({ state: idle, key: "\x1b[A", matchCount: 3, pageSize: 5 });

  expect(down.state.selected).toBe(1);
  expect(up.state.selected).toBe(0);
  expect(stuck.state.selected).toBe(0);
});

test("enter opens the run, right arrow opens the judge, and tab checks out", () => {
  const transcript = applyKey({ state: idle, key: "\r", matchCount: 2, pageSize: 5 });
  const judge = applyKey({ state: idle, key: "\x1b[C", matchCount: 2, pageSize: 5 });
  const checkout = applyKey({ state: idle, key: "\t", matchCount: 2, pageSize: 5 });
  const empty = applyKey({ state: idle, key: "\r", matchCount: 0, pageSize: 5 });
  const emptyJudge = applyKey({ state: idle, key: "\x1bOC", matchCount: 0, pageSize: 5 });

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

test("ctrl-x deletes unless the list is empty", () => {
  const remove = applyKey({ state: idle, key: "\x18", matchCount: 2, pageSize: 5 });
  const empty = applyKey({ state: idle, key: "\x18", matchCount: 0, pageSize: 5 });

  expect(remove.action).toBe("delete");
  expect(remove.state).toEqual(idle);
  expect(empty.action).toBe("stay");
});

test("letters filter, including q, and ctrl-c quits", () => {
  const typed = applyKey({ state: { query: "", selected: 4, scroll: 2 }, key: "q", matchCount: 10, pageSize: 5 });
  const quit = applyKey({ state: typed.state, key: "\x03", matchCount: 10, pageSize: 5 });

  expect(typed).toEqual({ state: { query: "q", selected: 0, scroll: 0 }, action: "stay" });
  expect(quit.action).toBe("quit");
});

test("page down keeps the previous row on screen", () => {
  const paged = applyKey({ state: idle, key: "\x1b[6~", matchCount: 10, pageSize: 5 });

  expect(paged.state.selected).toBe(4);
});

test("backspace drops the last character", () => {
  const cleared = applyKey({ state: { query: "ha", selected: 0, scroll: 0 }, key: "\x7f", matchCount: 1, pageSize: 5 });

  expect(cleared.state.query).toBe("h");
});

test("clampSelection keeps the highlight on screen", () => {
  const state = clampSelection({ state: { query: "", selected: 9, scroll: 0 }, matchCount: 10, pageSize: 4 });

  expect(state.selected).toBe(9);
  expect(state.scroll).toBe(6);
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
