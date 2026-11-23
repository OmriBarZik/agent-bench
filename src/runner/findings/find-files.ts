import type { FindingPoint } from "../../db/db.types";
import type { TranscriptUsage } from "../phases/split-phases.types";
import type { FileFindings, FindingContentBlock, FindingTranscriptEntry } from "./find-files.types";

/** A file of the offline dino game: its sources, BUILD.gn, or its page under components/neterror/resources. */
const GAME_SOURCE = /components\/neterror\/resources\/[\w./-]*\.(ts|js|html|css|gn|grd|grdp)\b/;

/** Where DevTools registers panels and views: a `*-meta.ts` file or an entrypoint module under front_end. */
const PANEL_REGISTRATION = /front_end\/[\w./-]*(-meta\.ts|entrypoints\/[\w-]+\/[\w-]+\.ts)\b/;

/** Search tools whose input names a directory or a glob, not a file the agent opened. */
const SEARCH_TOOLS = new Set(["Grep", "Glob", "ToolSearch"]);

/**
 * Finds the first API response whose tool calls open a dino game source and a DevTools panel registration, and
 * how many tokens the session had used up to and including it. Turns count main-session API responses once each.
 */
export function findFirstFiles(lines: string[]): FileFindings {
  const seen = new Set<string>();
  let turn = 0;
  let tokens = 0;
  let firstGameSource: FindingPoint | null = null;
  let firstPanelRegistration: FindingPoint | null = null;

  for (const line of lines) {
    const message = assistantMessage(line);

    if (!message?.id) {
      continue;
    }

    if (!seen.has(message.id)) {
      seen.add(message.id);
      turn += 1;
      tokens += usageTokens(message.usage ?? {});
    }

    const inputs = openedInputs(message.content);

    if (!firstGameSource && inputs.some((input) => GAME_SOURCE.test(input))) {
      firstGameSource = { turn, tokens };
    }

    if (!firstPanelRegistration && inputs.some((input) => PANEL_REGISTRATION.test(input))) {
      firstPanelRegistration = { turn, tokens };
    }
  }

  return { firstGameSource, firstPanelRegistration };
}

function assistantMessage(line: string) {
  if (!line.trim()) {
    return null;
  }

  try {
    const entry = JSON.parse(line) as FindingTranscriptEntry;

    return entry.type === "assistant" && !entry.isSidechain ? (entry.message ?? null) : null;
  } catch {
    // A line cut off while the session was being killed is not worth failing the search over.
    return null;
  }
}

function openedInputs(content: string | FindingContentBlock[] | undefined): string[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .filter((block) => block.type === "tool_use" && !SEARCH_TOOLS.has(block.name ?? ""))
    .map((block) => JSON.stringify(block.input ?? {}));
}

function usageTokens(usage: TranscriptUsage): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}
