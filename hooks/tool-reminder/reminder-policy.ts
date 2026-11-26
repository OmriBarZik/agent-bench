import type { ObservedCall, ReminderState, ReminderStep } from "./reminder-policy.types";

/** Never more than this many reminders in one session, so the hook nudges and does not nag. */
export const MAX_REMINDERS = 3;
/** After the first reminder, this many greps in a row with no call to the config's tools earn another one. */
export const GREPS_BEFORE_NEXT = 15;

export const EMPTY_STATE: ReminderState = { toolCalls: 0, grepsSinceNudge: 0, reminders: 0 };

/**
 * Decides whether a grep should be followed by a reminder of the config's own tool. The first grep before the tool
 * was ever used gets one; later, a run of greps with no tool call gets another. A call to the tool resets the run.
 */
export function stepReminder({ state, call }: { state: ReminderState; call: ObservedCall }): ReminderStep {
  if (call.usedSetupTool) {
    return { state: { ...state, toolCalls: state.toolCalls + 1, grepsSinceNudge: 0 }, remind: false };
  }

  if (!call.usedGrep) {
    return { state, remind: false };
  }

  const grepsSinceNudge = state.grepsSinceNudge + 1;
  const firstGrep = state.reminders === 0 && state.toolCalls === 0;
  const longRun = grepsSinceNudge >= GREPS_BEFORE_NEXT;
  const remind = state.reminders < MAX_REMINDERS && (firstGrep || longRun);

  if (!remind) {
    return { state: { ...state, grepsSinceNudge }, remind: false };
  }

  return { state: { ...state, grepsSinceNudge: 0, reminders: state.reminders + 1 }, remind: true };
}
