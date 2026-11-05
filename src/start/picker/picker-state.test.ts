import { describe, expect, test } from "bun:test";
import { applyPickerKey, initialPickerState, pickerResult, runCount } from "./picker-state";
import type { PickerChoices, PickerState } from "./picker-state.types";

const CHOICES: PickerChoices = {
  tasks: [
    { id: "t1", detail: "first" },
    { id: "t2", detail: "second" },
  ],
  configs: [
    { id: "baseline", detail: "" },
    { id: "serena", detail: "" },
  ],
};
const DOWN = "\x1b[B";
const RIGHT = "\x1b[C";

function press({ state, keys }: { state: PickerState; keys: string[] }): PickerState {
  return keys.reduce((current, key) => applyPickerKey({ state: current, choices: CHOICES, key }).state, state);
}

describe("picker state", () => {
  const fresh = initialPickerState({ choices: CHOICES, defaults: { repeats: 1, timeoutMin: 60, sync: false } });

  test("checks everything when no ids are given", () => {
    expect(runCount(fresh)).toBe(4);
  });

  test("checks only the flagged ids", () => {
    const state = initialPickerState({
      choices: CHOICES,
      defaults: { taskIds: ["t2"], configIds: ["serena"], repeats: 2, timeoutMin: 60, sync: false },
    });

    expect(pickerResult({ state, choices: CHOICES })).toMatchObject({ taskIds: ["t2"], configIds: ["serena"] });
    expect(runCount(state)).toBe(2);
  });

  test("space toggles a row and a toggles its section", () => {
    const unchecked = press({ state: fresh, keys: [" "] });

    expect(unchecked.tasks).toEqual([false, true]);

    const allOn = press({ state: unchecked, keys: ["a"] });

    expect(allOn.tasks).toEqual([true, true]);
    expect(press({ state: allOn, keys: ["a"] }).tasks).toEqual([false, false]);
  });

  test("digits replace, then append, on the repeats row", () => {
    const onRepeats = press({ state: fresh, keys: [DOWN, DOWN, DOWN, DOWN] });
    const typed = press({ state: onRepeats, keys: ["3", "2"] });

    expect(typed.repeats).toBe(32);
    expect(press({ state: typed, keys: [RIGHT] }).repeats).toBe(33);
  });

  test("enter refuses an empty task list", () => {
    const none = press({ state: fresh, keys: ["a"] });
    const outcome = applyPickerKey({ state: none, choices: CHOICES, key: "\r" });

    expect(outcome.action).toBe("stay");
    expect(outcome.state.notice).toBe("check at least one task");
  });

  test("enter starts and esc quits", () => {
    expect(applyPickerKey({ state: fresh, choices: CHOICES, key: "\r" }).action).toBe("start");
    expect(applyPickerKey({ state: fresh, choices: CHOICES, key: "\x1b" }).action).toBe("quit");
  });
});
