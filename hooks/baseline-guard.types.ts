/** The PreToolUse fields the baseline guard reads. Other payload fields are ignored. */
export type GuardPayload = {
  tool_name?: string;
  tool_input?: GuardToolInput;
};

/** Bash tool input. `command` is the shell text Claude asked to run. */
export type GuardToolInput = {
  command?: string;
};

/** JSON a PreToolUse hook prints to deny the tool call. */
export type GuardDeny = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    permissionDecision: "deny";
    permissionDecisionReason: string;
  };
};
