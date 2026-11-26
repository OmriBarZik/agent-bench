/** The command of a Bash call, the only tool input the reminder hook reads. */
export type ToolPayloadInput = {
  command?: string;
};

/** The PostToolUse payload fields the reminder hook reads. */
export type ToolPayload = {
  tool_name?: string;
  tool_input?: ToolPayloadInput;
};
