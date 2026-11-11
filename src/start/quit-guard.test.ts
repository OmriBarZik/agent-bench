import { expect, test } from "bun:test";
import type { TuiScreen } from "../tui/open-tui.types";
import type { ChromiumJobStatus } from "./jobs/chromium-job.types";
import { createQuitGuard, quitQuestion } from "./quit-guard";

const SIZE = { rows: 3, columns: 80 };

function setup(kind: ChromiumJobStatus["kind"]) {
  const state = { kind, quits: 0, keys: [] as string[] };
  const screen: TuiScreen = {
    render: () => "one\r\ntwo\r\nthree",
    onKey: (key) => {
      state.keys.push(key);
    },
    onEscape: () => false,
    onInterrupt: () => false,
    onResize: () => {},
    isBusy: () => false,
  };
  const guard = createQuitGuard({
    jobStatus: () => ({ kind: state.kind, label: "", logPath: null, stopping: false, logId: null }),
    quit: () => {
      state.quits += 1;
    },
  });

  return { state, guard, wrapped: guard.wrap(screen) };
}

test("esc with no job running is left to the TUI, which quits", () => {
  const { state, guard, wrapped } = setup("idle");

  expect(wrapped.onEscape()).toBe(false);
  guard.requestQuit();
  expect(state.quits).toBe(1);
});

test("esc during a benchmark run asks first, and y quits", () => {
  const { state, wrapped } = setup("matrix");

  expect(wrapped.onEscape()).toBe(true);
  expect(state.quits).toBe(0);
  expect(wrapped.render(SIZE)).toContain(quitQuestion("matrix"));
  expect(wrapped.render(SIZE).split("\r\n")).toHaveLength(3);

  wrapped.onKey("y");

  expect(state.quits).toBe(1);
  expect(state.keys).toEqual([]);
});

test("n, another key, or a second esc keeps the TUI open and the job running", () => {
  const { state, guard, wrapped } = setup("build");

  wrapped.onEscape();
  wrapped.onKey("n");
  expect(wrapped.render(SIZE)).toBe("one\r\ntwo\r\nthree");

  guard.requestQuit();
  expect(wrapped.onEscape()).toBe(true);
  expect(wrapped.render(SIZE)).toBe("one\r\ntwo\r\nthree");
  expect(state.quits).toBe(0);
  expect(state.keys).toEqual([]);
});

test("the question goes away when the job ends, and keys reach the screen again", () => {
  const { state, wrapped } = setup("matrix");

  wrapped.onEscape();
  state.kind = "idle";

  expect(wrapped.render(SIZE)).toBe("one\r\ntwo\r\nthree");

  wrapped.onKey("y");

  expect(state.quits).toBe(0);
  expect(state.keys).toEqual(["y"]);
});
