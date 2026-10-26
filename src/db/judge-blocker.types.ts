/** Why a tool stopped the agent: it was not there, it was refused, or it ran and kept failing. */
export type JudgeBlockerKind = "missing-tool" | "denied" | "exec-failed";

/** One thing the judge found that stopped the agent from finishing part of the task. */
export type JudgeBlocker = {
  kind: JudgeBlockerKind;
  /** The tool, MCP tool, or program, e.g. `Bash: autoninja` or `mcp__serena__find_symbol`. */
  tool: string;
  /** What the agent tried, what happened, and what it cost the task. */
  detail: string;
};
