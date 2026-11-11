import { describe, expect, test } from "bun:test";
import { splitPhases } from "./split-phases";

function assistant({ id, time, tool, output }: { id: string; time: string; tool: string; output: number }): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: `2026-11-11T10:00:${time}Z`,
    message: {
      id,
      usage: { input_tokens: 1, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      content: [{ type: "tool_use", name: tool }],
    },
  });
}

describe("splitPhases", () => {
  test("starts validation at the first chrome-validate call and counts each message once", () => {
    const lines = [
      assistant({ id: "a", time: "00", tool: "Read", output: 10 }),
      assistant({ id: "a", time: "01", tool: "Grep", output: 10 }),
      assistant({ id: "b", time: "10", tool: "Edit", output: 20 }),
      assistant({ id: "c", time: "30", tool: "mcp__chrome-validate__start_build", output: 30 }),
      assistant({ id: "d", time: "40", tool: "Edit", output: 40 }),
      "not json",
    ];

    const [discovery, validation] = splitPhases({ lines, costUsd: 1 });

    expect(discovery).toMatchObject({ phase: "discovery", turns: 2, outputTokens: 30, durationMs: 30_000 });
    expect(validation).toMatchObject({ phase: "validation", turns: 2, outputTokens: 70, durationMs: 10_000 });
    expect((discovery?.costUsd ?? 0) + (validation?.costUsd ?? 0)).toBeCloseTo(1);
  });

  test("puts the whole run in discovery when the agent never validates", () => {
    const lines = [assistant({ id: "a", time: "00", tool: "Edit", output: 5 })];

    const [discovery, validation] = splitPhases({ lines, costUsd: null });

    expect(discovery).toMatchObject({ turns: 1, outputTokens: 5, costUsd: null });
    expect(validation).toMatchObject({ turns: 0, totalTokens: 0, durationMs: 0 });
  });
});
