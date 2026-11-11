import type { TranscriptBlock, TranscriptEntry } from "./format-entry.types";

/** Longest tool input summary or error line kept in the live log. */
const MAX_SUMMARY = 240;
/** Input fields that say the most about a tool call, in the order they are tried. */
const SUMMARY_FIELDS = ["command", "file_path", "pattern", "query", "skill", "url", "description", "prompt", "path"];

/**
 * Turns one transcript JSONL line into readable live-log lines: the agent's text, each tool call with
 * a short summary of its input, and failed tool results. Anything else (thinking, metadata) gives no lines.
 */
export function formatTranscriptLine(line: string): string[] {
  let entry: TranscriptEntry;

  try {
    entry = JSON.parse(line) as TranscriptEntry;
  } catch {
    // A half-written or foreign line is skipped; the live log is a convenience, not a record.
    return [];
  }

  const content = entry.message?.content;

  if (!Array.isArray(content)) {
    return [];
  }

  if (entry.type === "assistant") {
    return content.flatMap(assistantLines);
  }

  if (entry.type === "user") {
    return content.flatMap(toolResultLines);
  }

  return [];
}

function assistantLines(block: TranscriptBlock): string[] {
  if (block.type === "text" && block.text) {
    return block.text
      .trim()
      .split("\n")
      .map((textLine, index) => (index === 0 ? `● ${textLine}` : `  ${textLine}`));
  }

  if (block.type === "tool_use") {
    const summary = inputSummary(block.input);

    return [summary ? `→ ${block.name ?? "tool"}: ${summary}` : `→ ${block.name ?? "tool"}`];
  }

  return [];
}

function toolResultLines(block: TranscriptBlock): string[] {
  if (block.type !== "tool_result" || block.is_error !== true) {
    return [];
  }

  return [`  ✗ ${clip(resultText(block.content))}`];
}

function inputSummary(input: Record<string, unknown> | undefined): string {
  if (!input) {
    return "";
  }

  for (const field of SUMMARY_FIELDS) {
    const value = input[field];

    if (typeof value === "string" && value !== "") {
      return clip(value);
    }
  }

  const json = JSON.stringify(input);

  return json === "{}" ? "" : clip(json);
}

function resultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part: TranscriptBlock) => part.text ?? "")
      .filter(Boolean)
      .join(" ");
  }

  return "error";
}

/** One line, at most MAX_SUMMARY characters. */
function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();

  return flat.length > MAX_SUMMARY ? `${flat.slice(0, MAX_SUMMARY - 1)}…` : flat;
}
