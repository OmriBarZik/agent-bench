import { describe, expect, test } from "bun:test";
import { restoreTerminalTitle, saveTerminalTitle, setTerminalTitle, titleSequence } from "./terminal-title";
import { benchEndTitle, buildTitle, formatElapsed, runTitle, tabTitle } from "./title-text";

describe("terminal titles", () => {
  test("a run shows its progress and step before the task and config", () => {
    const title = runTitle({ index: 3, total: 12, taskId: "omnibox", configId: "baseline", repeat: 1, phase: "judge" });

    expect(title).toBe("▶ 3/12 judge · omnibox × baseline r1");
  });

  test("a run that has reached the agent leads with how long the agent has had the task", () => {
    const title = runTitle({
      index: 3,
      total: 12,
      taskId: "omnibox",
      configId: "baseline",
      repeat: 1,
      phase: "agent",
      elapsedMs: 65_000,
    });

    expect(title).toBe("▶ 1:05 · 3/12 agent · omnibox × baseline r1");
  });

  test("elapsed time stays in minutes until an hour has passed", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7_000)).toBe("0:07");
    expect(formatElapsed(3_599_000)).toBe("59:59");
    expect(formatElapsed(3_602_000)).toBe("1:00:02");
  });

  test("the benchmark end says whether every run finished", () => {
    expect(benchEndTitle({ finished: 4, total: 4, stopped: false })).toBe("✅ done 4/4 · agent-bench");
    expect(benchEndTitle({ finished: 2, total: 4, stopped: true })).toBe("⏹ stopped 2/4 · agent-bench");
  });

  test("a build names its step and where it runs", () => {
    const title = buildTitle({ taskId: "omnibox", configId: "baseline", repeat: 0, where: "build-mac", step: "copy" });

    expect(title).toBe("🔨 copy build-mac · omnibox × baseline r0");
  });

  test("the TUI names the tab it shows", () => {
    expect(tabTitle("Start")).toBe("agent-bench · Start");
    expect(tabTitle("Runs")).toBe("agent-bench · Runs");
  });

  test("control characters cannot end the title sequence early", () => {
    expect(titleSequence("a\x07b\x1bc")).toBe("\x1b]0;a b c\x07");
  });

  test("the process name follows the tab title", () => {
    const previous = process.title;

    try {
      setTerminalTitle("a\x07b · agent-bench");

      expect(process.title).toBe("a b · agent-bench");
    } finally {
      process.title = previous;
    }
  });

  test("leaving the TUI restores the process name", () => {
    const previous = process.title;
    saveTerminalTitle();

    try {
      setTerminalTitle("agent-bench · Runs");
    } finally {
      restoreTerminalTitle();
    }

    expect(process.title).toBe(previous);
  });
});
