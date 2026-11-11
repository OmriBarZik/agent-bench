import { describe, expect, test } from "bun:test";
import { formatTranscriptLine } from "./format-entry";

describe("formatTranscriptLine", () => {
  test("shows assistant text and tool calls", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "hidden" },
          { type: "text", text: "Looking at trex.ts\nthen editing" },
          { type: "tool_use", name: "Bash", input: { command: "ls\n  -la", description: "list" } },
          { type: "tool_use", name: "mcp__chrome-validate__start_build", input: {} },
        ],
      },
    });

    expect(formatTranscriptLine(line)).toEqual([
      "● Looking at trex.ts",
      "  then editing",
      "→ Bash: ls -la",
      "→ mcp__chrome-validate__start_build",
    ]);
  });

  test("shows only failed tool results", () => {
    const line = JSON.stringify({
      type: "user",
      message: {
        content: [
          { type: "tool_result", is_error: true, content: "cd is denied" },
          { type: "tool_result", content: [{ type: "text", text: "ok" }] },
        ],
      },
    });

    expect(formatTranscriptLine(line)).toEqual(["  ✗ cd is denied"]);
  });

  test("skips metadata, string prompts and bad json", () => {
    expect(formatTranscriptLine(JSON.stringify({ type: "user", message: { content: "the task" } }))).toEqual([]);
    expect(formatTranscriptLine(JSON.stringify({ type: "system" }))).toEqual([]);
    expect(formatTranscriptLine("{not json")).toEqual([]);
  });

  test("clips long input", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: "x".repeat(500) } }] },
    });
    const [formatted] = formatTranscriptLine(line);

    expect(formatted.length).toBe("→ Bash: ".length + 240);
  });
});
