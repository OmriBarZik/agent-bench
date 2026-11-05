import { describe, expect, test } from "bun:test";
import { titleSequence } from "./terminal-title";
import { benchEndTitle, buildTitle, runTitle, tabTitle } from "./title-text";

describe("terminal titles", () => {
  test("a run shows its progress and step before the task and config", () => {
    const title = runTitle({ index: 3, total: 12, taskId: "omnibox", configId: "baseline", repeat: 1, phase: "judge" });

    expect(title).toBe("▶ 3/12 judge · omnibox × baseline r1");
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
});
