import type { PhaseTranscriptEntry } from "./split-phases.types";

/** Tool names from the chrome-validate MCP server start with this. */
export const VALIDATE_TOOL_PREFIX = "mcp__chrome-validate__";

/**
 * Milliseconds the agent spent waiting on chrome-validate tools (builds and Chrome runs): for each such tool_use,
 * the time from the entry that made the call to the entry that carries its tool_result. The agent does no work
 * while these run, so the run's work time is its wall clock minus this.
 */
export function validateWaitMs(entries: PhaseTranscriptEntry[]): number {
  const calledAt = new Map<string, number>();
  let waited = 0;

  for (const entry of entries) {
    const time = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
    const content = entry.message?.content;

    if (Number.isNaN(time) || !Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (block.type === "tool_use" && block.id && (block.name ?? "").startsWith(VALIDATE_TOOL_PREFIX)) {
        calledAt.set(block.id, time);
      }

      const started = block.type === "tool_result" && block.tool_use_id ? calledAt.get(block.tool_use_id) : undefined;

      if (started !== undefined && block.tool_use_id) {
        waited += Math.max(0, time - started);
        calledAt.delete(block.tool_use_id);
      }
    }
  }

  return waited;
}
