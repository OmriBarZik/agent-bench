import { clampSelection, matchingChoices } from "./select-state";
import type { RunChoice, SelectState } from "./select-state.types";

/**
 * The list state after the runs were reloaded: the same filter, with the highlight on the run it was on before.
 * When that run is gone (removed elsewhere, or filtered out), the highlight keeps its row and is clamped.
 */
export function reselect({
  state,
  choices,
  highlightedRunId,
  pageSize,
}: {
  state: SelectState;
  choices: RunChoice[];
  highlightedRunId: string | null;
  pageSize: number;
}): SelectState {
  const matches = matchingChoices({ choices, query: state.query });
  const index = matches.findIndex((choice) => choice.runId === highlightedRunId);
  const selected = index === -1 ? state.selected : index;

  return clampSelection({ state: { ...state, selected }, matchCount: matches.length, pageSize });
}

/** The notice after a reload, saying how many runs appeared or went away. */
export function refreshNotice({ before, after }: { before: number; after: number }): string {
  const change = after - before;

  if (change === 0) {
    return `refreshed: ${after} runs, none new`;
  }

  const delta = change > 0 ? `${change} new` : `${-change} gone`;

  return `refreshed: ${after} runs, ${delta}`;
}
