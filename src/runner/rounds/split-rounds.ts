import type { RoundSegment, RoundSegmentUsage, RoundToolCount, RunRounds } from "../../db/db.types";
import { usageWeight } from "../phases/split-phases";
import { VALIDATE_TOOL_PREFIX } from "../phases/validate-waits";
import { callTools, messageKind } from "./classify-call";
import { readTranscript } from "./read-transcript";
import { roundResult } from "./round-outcome";
import type { PlacedMessage, RoundCallResult, RoundMessage } from "./split-rounds.types";

const SEGMENTS: RoundSegment[] = ["discovery", "implementation", "validation"];

/**
 * Splits one agent transcript into rounds. A round is discovery (reading and searching before its first edit),
 * implementation (from that edit until a response only builds or checks Chrome; a response that edits and starts a
 * build is still implementation) and validation (its chrome-validate responses). The first response after
 * validation that does anything else starts the next round, so a failed build and the search or fix that follows
 * it begin round 2. A last round that neither edits nor validates (the agent's closing summary) belongs to the
 * round before it. Each segment's work time runs from its first response to the next segment's, minus
 * chrome-validate waits; the run's cost is shared out by price-weighted tokens.
 */
export function splitRounds({
  lines,
  costUsd,
  setupTools,
  finalPaths,
}: {
  lines: string[];
  costUsd: number | null;
  setupTools: string[];
  finalPaths: Set<string>;
}): RunRounds {
  const transcript = readTranscript(lines);
  const placed = placeMessages(transcript.messages);
  const lastRound = placed.at(-1)?.round ?? 0;
  const totalWeight = placed.reduce((total, item) => total + usageWeight(item.message.usage), 0);
  const segments: RoundSegmentUsage[] = [];
  const tools: RoundToolCount[] = [];

  for (let round = 1; round <= lastRound; round += 1) {
    for (const segment of SEGMENTS) {
      const items = placed.filter((item) => item.round === round && item.segment === segment);

      if (items.length > 0) {
        segments.push(segmentUsage({ round, segment, items, placed, transcript, totalWeight, costUsd }));
        tools.push(...segmentTools({ round, segment, items, setupTools }));
      }
    }
  }

  const results = Array.from({ length: lastRound }, (_, index) =>
    roundResult({ round: index + 1, placed, results: transcript.results, finalPaths, isLast: index + 1 === lastRound }),
  );

  return { segments, results, tools };
}

function placeMessages(messages: RoundMessage[]): PlacedMessage[] {
  const placed: PlacedMessage[] = [];
  let round = 1;
  let segment: RoundSegment = "discovery";

  for (const message of messages) {
    const kind = messageKind(message);

    if (kind !== "validate" && segment === "validation") {
      round += 1;
      segment = "discovery";
    }

    if (kind === "validate") {
      segment = "validation";
    } else if (kind === "edit") {
      segment = "implementation";
    }

    placed.push({ message, round, segment });
  }

  const lastRound = placed.at(-1)?.round ?? 1;
  const closing = placed.filter((item) => item.round === lastRound);

  if (lastRound > 1 && closing.every((item) => item.segment === "discovery")) {
    for (const item of closing) {
      item.round = lastRound - 1;
      item.segment = "validation";
    }
  }

  return placed;
}

function segmentUsage({
  round,
  segment,
  items,
  placed,
  transcript,
  totalWeight,
  costUsd,
}: {
  round: number;
  segment: RoundSegment;
  items: PlacedMessage[];
  placed: PlacedMessage[];
  transcript: { results: Map<string, RoundCallResult>; sessionEnd: number };
  totalWeight: number;
  costUsd: number | null;
}): RoundSegmentUsage {
  const start = items[0]?.message.time ?? 0;
  const lastIndex = placed.indexOf(items.at(-1) as PlacedMessage);
  const end = placed[lastIndex + 1]?.message.time ?? transcript.sessionEnd;
  const waitMs = items
    .flatMap((item) => item.message.calls.map((call) => ({ call, time: item.message.time })))
    .filter(({ call }) => call.name.startsWith(VALIDATE_TOOL_PREFIX))
    .reduce((total, { call, time }) => {
      const result = transcript.results.get(call.id);

      return total + (result ? Math.max(0, result.time - time) : 0);
    }, 0);
  const totalTokens = items.reduce((total, item) => {
    const usage = item.message.usage;

    return (
      total +
      (usage.input_tokens ?? 0) +
      (usage.output_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0)
    );
  }, 0);
  const weight = items.reduce((total, item) => total + usageWeight(item.message.usage), 0);
  const share = totalWeight > 0 ? weight / totalWeight : 0;

  return {
    round,
    segment,
    turns: items.length,
    workMs: Math.max(0, end - start - waitMs),
    totalTokens,
    costUsd: costUsd === null ? null : costUsd * share,
  };
}

function segmentTools({
  round,
  segment,
  items,
  setupTools,
}: {
  round: number;
  segment: RoundSegment;
  items: PlacedMessage[];
  setupTools: string[];
}): RoundToolCount[] {
  const counts = new Map<string, RoundToolCount>();

  for (const call of items.flatMap((item) => item.message.calls)) {
    for (const { tool, kind } of callTools(call)) {
      const known = counts.get(tool);
      const setupTool = setupTools.some((setupTool) => tool === setupTool || tool.startsWith(setupTool));
      counts.set(tool, { round, segment, tool, kind, setupTool, calls: (known?.calls ?? 0) + 1 });
    }
  }

  return [...counts.values()];
}
