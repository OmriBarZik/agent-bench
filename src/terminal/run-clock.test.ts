import { describe, expect, test } from "bun:test";
import { createRunClock } from "./run-clock";

describe("run clock", () => {
  test("the clock starts when the agent is given the task and keeps going through the judge", () => {
    let current = 1_000;
    const titles: string[] = [];
    const held: { tick: (() => void) | null } = { tick: null };
    let stopped = false;
    const clock = createRunClock({
      target: { index: 2, total: 5, taskId: "omnibox", configId: "baseline", repeat: 0 },
      now: () => current,
      show: (title) => {
        titles.push(title);
      },
      every: (callback) => {
        held.tick = callback;

        return () => {
          stopped = true;
        };
      },
    });

    clock.setPhase("reset");
    expect(titles.at(-1)).toBe("▶ 2/5 reset · omnibox × baseline r0");

    clock.setPhase("agent");
    expect(titles.at(-1)).toBe("▶ 0:00 · 2/5 agent · omnibox × baseline r0");

    current += 65_000;
    held.tick?.();
    expect(titles.at(-1)).toBe("▶ 1:05 · 2/5 agent · omnibox × baseline r0");

    clock.setPaused(true);
    expect(titles.at(-1)).toBe("▶ 1:05 · 2/5 paused · omnibox × baseline r0");
    current += 120_000;
    held.tick?.();
    expect(titles.at(-1)).toBe("▶ 1:05 · 2/5 paused · omnibox × baseline r0");

    clock.setPaused(false);
    current += 5_000;
    held.tick?.();
    expect(titles.at(-1)).toBe("▶ 1:10 · 2/5 agent · omnibox × baseline r0");

    clock.setPhase("judge");
    expect(titles.at(-1)).toBe("▶ 1:10 · 2/5 judge · omnibox × baseline r0");

    current += 3_600_000;
    held.tick?.();
    expect(titles.at(-1)).toBe("▶ 1:01:10 · 2/5 judge · omnibox × baseline r0");

    clock.stop();
    expect(stopped).toBe(true);
    held.tick?.();
    expect(titles.at(-1)).toBe("▶ 1:01:10 · 2/5 judge · omnibox × baseline r0");
  });
});
