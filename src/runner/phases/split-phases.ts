import type { PhaseUsage, RunPhase } from "../../db/db.types";
import type { PhaseMessage, PhaseTranscriptEntry, TranscriptContentBlock, TranscriptUsage } from "./split-phases.types";

/** Tool names from the chrome-validate MCP server start with this. */
const VALIDATE_TOOL_PREFIX = "mcp__chrome-validate__";

/** Price of each token kind relative to fresh input. The same ratios hold for every Claude model. */
const PRICE_WEIGHT = { input: 1, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1, output: 5 };

/**
 * Splits one agent transcript into discovery (finding the code and writing the change) and validation, which
 * starts with the API response that first calls a chrome-validate tool and runs to the end of the session, fix
 * loops included. Usage is read once per API response, since the transcript repeats it on every content block.
 * The run's cost is shared out by price-weighted tokens, so the two phases add up to cost_usd.
 */
export function splitPhases({ lines, costUsd }: { lines: string[]; costUsd: number | null }): PhaseUsage[] {
  const messages = new Map<string, PhaseMessage>();
  const timestamps: number[] = [];
  let validationStart: number | null = null;

  for (const line of lines) {
    const entry = parseEntry(line);
    const time = entry?.timestamp ? Date.parse(entry.timestamp) : Number.NaN;

    if (!Number.isNaN(time)) {
      timestamps.push(time);
    }

    const message = entry?.message;

    if (entry?.type !== "assistant" || entry.isSidechain || !message?.id) {
      continue;
    }

    const callsValidate = hasValidateCall(message.content);

    if (callsValidate && validationStart === null && !Number.isNaN(time)) {
      validationStart = time;
    }

    const known = messages.get(message.id);
    const validation = validationStart !== null || callsValidate;
    messages.set(message.id, {
      usage: message.usage ?? known?.usage ?? {},
      validation: (known?.validation ?? false) || validation,
    });
  }

  const sessionStart = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const sessionEnd = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  const split = validationStart ?? sessionEnd;
  const all = [...messages.values()];
  const discovery = all.filter((message) => !message.validation);
  const validation = all.filter((message) => message.validation);
  const totalWeight = weightOf(all);

  return [
    phaseUsage({ phase: "discovery", messages: discovery, durationMs: split - sessionStart, costUsd, totalWeight }),
    phaseUsage({ phase: "validation", messages: validation, durationMs: sessionEnd - split, costUsd, totalWeight }),
  ];
}

function parseEntry(line: string): PhaseTranscriptEntry | null {
  if (!line.trim()) {
    return null;
  }

  try {
    return JSON.parse(line) as PhaseTranscriptEntry;
  } catch {
    // A line cut off while the session was being killed is not worth failing the split over.
    return null;
  }
}

function hasValidateCall(content: string | TranscriptContentBlock[] | undefined): boolean {
  if (!Array.isArray(content)) {
    return false;
  }

  return content.some((block) => block.type === "tool_use" && (block.name ?? "").startsWith(VALIDATE_TOOL_PREFIX));
}

function phaseUsage({
  phase,
  messages,
  durationMs,
  costUsd,
  totalWeight,
}: {
  phase: RunPhase;
  messages: PhaseMessage[];
  durationMs: number;
  costUsd: number | null;
  totalWeight: number;
}): PhaseUsage {
  const sum = (pick: (usage: TranscriptUsage) => number | undefined) =>
    messages.reduce((total, message) => total + (pick(message.usage) ?? 0), 0);
  const inputTokens = sum((usage) => usage.input_tokens);
  const outputTokens = sum((usage) => usage.output_tokens);
  const cacheCreationTokens = sum((usage) => usage.cache_creation_input_tokens);
  const cacheReadTokens = sum((usage) => usage.cache_read_input_tokens);
  const share = totalWeight > 0 ? weightOf(messages) / totalWeight : 0;

  return {
    phase,
    turns: messages.length,
    durationMs: Math.max(0, durationMs),
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
    costUsd: costUsd === null ? null : costUsd * share,
  };
}

function weightOf(messages: PhaseMessage[]): number {
  return messages.reduce((total, message) => total + usageWeight(message.usage), 0);
}

function usageWeight(usage: TranscriptUsage): number {
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheWrite1h = Math.min(cacheWrite, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0);

  return (
    (usage.input_tokens ?? 0) * PRICE_WEIGHT.input +
    cacheWrite1h * PRICE_WEIGHT.cacheWrite1h +
    (cacheWrite - cacheWrite1h) * PRICE_WEIGHT.cacheWrite5m +
    (usage.cache_read_input_tokens ?? 0) * PRICE_WEIGHT.cacheRead +
    (usage.output_tokens ?? 0) * PRICE_WEIGHT.output
  );
}
