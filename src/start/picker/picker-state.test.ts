import { describe, expect, test } from "bun:test";
import { applyPickerKey, initialPickerState, pickerResult, pickerRows, runCount } from "./picker-state";
import type { PickerChoices, PickerDefaults, PickerState } from "./picker-state.types";

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
const LEFT = "\x1b[D";
const RIGHT = "\x1b[C";
const DEFAULTS: PickerDefaults = { repeats: 1, timeoutMin: 60, buildTimeoutMin: 90, sync: false, autoReview: true };

function press({ state, keys }: { state: PickerState; keys: string[] }): PickerState {
  return keys.reduce(
    (current, key) => applyPickerKey({ state: current, choices: CHOICES, defaults: DEFAULTS, key }).state,
    state,
  );
}

describe("picker state", () => {
  const fresh = initialPickerState({ choices: CHOICES, defaults: DEFAULTS });

  test("checks everything when no ids are given", () => {
    expect(runCount(fresh)).toBe(4);
  });

  test("checks only the flagged ids", () => {
    const state = initialPickerState({
      choices: CHOICES,
      defaults: {
        taskIds: ["t2"],
        configIds: ["serena"],
        repeats: 2,
        timeoutMin: 60,
        buildTimeoutMin: 90,
        sync: false,
        autoReview: true,
      },
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
    expect(press({ state: typed, keys: [LEFT] }).repeats).toBe(31);
    expect(press({ state: typed, keys: ["+", "-"] }).repeats).toBe(32);
  });

  test("r resets the values and keeps the cursor", () => {
    const changed = press({ state: fresh, keys: [" ", DOWN, DOWN, DOWN, DOWN, "4"] });
    const reset = press({ state: changed, keys: ["r"] });

    expect(changed.tasks).toEqual([false, true]);
    expect(reset.repeats).toBe(DEFAULTS.repeats);
    expect(reset.cursor).toBe(changed.cursor);
    expect(reset.tasks).toEqual([true, true]);
  });

  test("starts on a saved cursor and clamps it to the last row", () => {
    const state = initialPickerState({ choices: CHOICES, defaults: { ...DEFAULTS, cursor: 99 } });

    expect(state.cursor).toBe(pickerRows(CHOICES).length - 1);
  });

  test("enter refuses an empty task list", () => {
    const none = press({ state: fresh, keys: ["a"] });
    const outcome = applyPickerKey({ state: none, choices: CHOICES, defaults: DEFAULTS, key: "\r" });

    expect(outcome.action).toBe("stay");
    expect(outcome.state.notice).toBe("check at least one task");
  });

  test("space toggles auto review", () => {
    const onReview = press({ state: fresh, keys: [DOWN, DOWN, DOWN, DOWN, DOWN, DOWN, DOWN, DOWN] });

    expect(onReview.autoReview).toBe(true);
    expect(press({ state: onReview, keys: [RIGHT] }).autoReview).toBe(true);
    expect(press({ state: onReview, keys: [LEFT] }).autoReview).toBe(false);
    expect(press({ state: onReview, keys: [" "] }).autoReview).toBe(false);
    expect(pickerResult({ state: press({ state: onReview, keys: [" "] }), choices: CHOICES }).autoReview).toBe(false);
  });

  test("enter starts and esc quits", () => {
    expect(applyPickerKey({ state: fresh, choices: CHOICES, defaults: DEFAULTS, key: "\r" }).action).toBe("start");
    expect(applyPickerKey({ state: fresh, choices: CHOICES, defaults: DEFAULTS, key: "\x1b" }).action).toBe("quit");
  });
});
