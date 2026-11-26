/** What the reminder hook remembers about one run between tool calls. */
export type ReminderState = {
  /** Calls to the config's own tools. */
  toolCalls: number;
  /** grep searches since the last call to the config's tools or the last reminder. */
  grepsSinceNudge: number;
  /** Reminders already shown. */
  reminders: number;
};

/** One finished tool call as the policy sees it. */
export type ObservedCall = {
  usedSetupTool: boolean;
  usedGrep: boolean;
};

/** The state after a call, and whether to remind the agent now. */
export type ReminderStep = {
  state: ReminderState;
  remind: boolean;
};
