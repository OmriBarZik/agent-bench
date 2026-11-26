import { expect, test } from "bun:test";
import { EMPTY_STATE, GREPS_BEFORE_NEXT, MAX_REMINDERS, stepReminder } from "./reminder-policy";
import type { ObservedCall, ReminderState } from "./reminder-policy.types";

const GREP: ObservedCall = { usedSetupTool: false, usedGrep: true };
const TOOL: ObservedCall = { usedSetupTool: true, usedGrep: false };

function replay(calls: ObservedCall[]): boolean[] {
  let state: ReminderState = EMPTY_STATE;

  return calls.map((call) => {
    const step = stepReminder({ state, call });
    state = step.state;

    return step.remind;
  });
}

test("the first grep before the tool is used gets a reminder, the next ones do not", () => {
  expect(replay([GREP, GREP, GREP])).toEqual([true, false, false]);
});

test("a grep after the tool was used is fine until a long run of greps", () => {
  const calls = [TOOL, ...Array.from({ length: GREPS_BEFORE_NEXT }, () => GREP)];
  const reminded = replay(calls);

  expect(reminded.slice(0, -1).every((remind) => !remind)).toBe(true);
  expect(reminded.at(-1)).toBe(true);
});

test("never more than the maximum number of reminders", () => {
  const calls = Array.from({ length: GREPS_BEFORE_NEXT * 10 }, () => GREP);

  expect(replay(calls).filter(Boolean)).toHaveLength(MAX_REMINDERS);
});
