import { detailLines } from "./detail-pane";
import { choiceLabel } from "./format-run";
import type { FrameLayout } from "./render-frame.types";
import { matchingChoices } from "./select-state";
import type { RunChoice, SelectState } from "./select-state.types";
import { colorLine, fit, fitEnd } from "./terminal-text";
import type { LineKind } from "./terminal-text.types";

/** Splits a terminal height into the list and the detail pane under it. */
export function frameLayout(rows: number): FrameLayout {
  const header = 2;
  const gap = 1;
  const detailHeight = Math.min(8, Math.max(4, rows - header - gap - 3));
  const listHeight = Math.max(1, rows - header - gap - detailHeight);

  return { listHeight, detailHeight };
}

/** Draws the run list. The result includes cursor-hiding color codes. */
export function renderFrame({
  choices,
  state,
  chromiumSrc,
  notice,
  rows,
  columns,
}: {
  choices: RunChoice[];
  state: SelectState;
  chromiumSrc: string;
  notice: string;
  rows: number;
  columns: number;
}): string {
  const matches = matchingChoices({ choices, query: state.query });
  const layout = frameLayout(rows);
  const lines: string[] = [headerLine({ choices, matches, chromiumSrc, columns }), hintLine({ state, columns })];

  for (let index = 0; index < layout.listHeight; index++) {
    lines.push(listLine({ matches, state, index, columns }));
  }

  lines.push(colorLine({ text: "", kind: "plain" }));

  for (const line of detailLines({
    choice: matches[state.selected],
    notice,
    height: layout.detailHeight,
    columns,
  })) {
    lines.push(line);
  }

  const visible = lines.slice(0, rows);

  while (visible.length < rows) {
    visible.push(colorLine({ text: "", kind: "plain" }));
  }

  return `\x1b[H${visible.join("\n")}\x1b[J`;
}

function listLine({
  matches,
  state,
  index,
  columns,
}: {
  matches: RunChoice[];
  state: SelectState;
  index: number;
  columns: number;
}): string {
  const choice = matches[state.scroll + index];

  if (!choice) {
    const text = index === 0 && matches.length === 0 ? "  no matching runs" : "";

    return colorLine({ text: fit({ text, width: columns }), kind: "plain" });
  }

  const selected = state.scroll + index === state.selected;
  const text = fit({
    text: `${markerFor({ choice, selected })}${choiceLabel(choice)}  ${choice.model}`,
    width: columns,
  });

  return colorLine({ text, kind: rowKind({ selected, present: choice.present }) });
}

function headerLine({
  choices,
  matches,
  chromiumSrc,
  columns,
}: {
  choices: RunChoice[];
  matches: RunChoice[];
  chromiumSrc: string;
  columns: number;
}): string {
  const left = `Inspect a run   ${countLabel({ shown: matches.length, total: choices.length })}`;
  const room = columns - left.length - 2;

  if (room < 4) {
    return colorLine({ text: fit({ text: left, width: columns }), kind: "title" });
  }

  const text = fit({ text: `${left}  ${fitEnd({ text: chromiumSrc, width: room })}`, width: columns });

  return colorLine({ text, kind: "title" });
}

function hintLine({ state, columns }: { state: SelectState; columns: number }): string {
  const filter = state.query === "" ? "type to filter" : `filter: ${state.query}`;
  const text = fit({ text: `↑↓ move    enter transcript    tab checkout    ${filter}    esc quit`, width: columns });

  return colorLine({ text, kind: "hint" });
}

function countLabel({ shown, total }: { shown: number; total: number }): string {
  const all = total === 1 ? "1 run" : `${total} runs`;

  if (shown === total) {
    return all;
  }

  return `${shown} of ${all}`;
}

function rowKind({ selected, present }: { selected: boolean; present: boolean }): LineKind {
  if (selected) {
    return "selected";
  }

  if (!present) {
    return "dim";
  }

  return "plain";
}

function markerFor({ choice, selected }: { choice: RunChoice; selected: boolean }): string {
  if (selected) {
    return "> ";
  }

  if (choice.current) {
    return "* ";
  }

  return "  ";
}
