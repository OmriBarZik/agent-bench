import { parseEntry } from "../phases/split-phases";
import type {
  RoundCall,
  RoundContentBlock,
  RoundCallResult,
  RoundMessage,
  RoundTranscript,
  RoundTranscriptEntry,
} from "./split-rounds.types";

/**
 * Reads a session transcript into the main agent's API responses, in order, and every tool result by call id. The
 * transcript writes one line per content block of a response, so lines with the same message id are merged.
 * Subagent (sidechain) lines are left out.
 */
export function readTranscript(lines: string[]): RoundTranscript {
  const messages = new Map<string, RoundMessage>();
  const results = new Map<string, RoundCallResult>();
  let sessionEnd = 0;

  for (const line of lines) {
    const entry = parseEntry(line) as RoundTranscriptEntry | null;
    const time = entry?.timestamp ? Date.parse(entry.timestamp) : Number.NaN;

    if (!entry || Number.isNaN(time) || entry.isSidechain) {
      continue;
    }

    sessionEnd = Math.max(sessionEnd, time);
    const content = Array.isArray(entry.message?.content) ? entry.message.content : [];

    for (const block of content) {
      if (block.type === "tool_result" && block.tool_use_id && !results.has(block.tool_use_id)) {
        results.set(block.tool_use_id, { time, text: resultText(block.content), isError: block.is_error === true });
      }
    }

    const messageId = entry.message?.id;

    if (entry.type !== "assistant" || !messageId) {
      continue;
    }

    const message = messages.get(messageId) ?? { id: messageId, time, usage: {}, calls: [] };
    message.usage = entry.message?.usage ?? message.usage;

    for (const block of content) {
      if (block.type === "tool_use" && block.id && !message.calls.some((call) => call.id === block.id)) {
        const call: RoundCall = { id: block.id, name: block.name ?? "", input: block.input ?? {} };
        message.calls.push(call);
      }
    }

    messages.set(messageId, message);
  }

  return { messages: [...messages.values()].sort((left, right) => left.time - right.time), results, sessionEnd };
}

function resultText(content: RoundContentBlock["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content.map((part) => part.text ?? "").join("\n");
}
