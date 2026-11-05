import { colorLine, fit } from "../../inspect/render/terminal-text";
import { pickerRows, runCount } from "./picker-state";
import type { PickerChoices, PickerItem, PickerRow, PickerState } from "./picker-state.types";
import type { PickerFrame, PickerLine } from "./render-picker.types";

const HEADER_HEIGHT = 2;
const FOOTER_HEIGHT = 4;
const HINT = "↑↓ move  space toggle  a all/none  ←→ or digits change  enter start  esc quit";

/** Draws the whole picker. The body scrolls so the cursor row stays on screen. */
export function renderPicker({
  choices,
  state,
  scroll,
  rows,
  columns,
}: {
  choices: PickerChoices;
  state: PickerState;
  scroll: number;
  rows: number;
  columns: number;
}): PickerFrame {
  const body = bodyLines({ choices, state, columns });
  const height = Math.max(rows - HEADER_HEIGHT - FOOTER_HEIGHT, 1);
  const nextScroll = scrollFor({ body, cursor: state.cursor, scroll, height });
  const lines = [
    colorLine({
      text: fit({ text: "Start a benchmark: pick tasks × configs × repeats", width: columns }),
      kind: "title",
    }),
    colorLine({ text: "", kind: "plain" }),
  ];

  for (let index = 0; index < height; index++) {
    const line = body[nextScroll + index];
    lines.push(
      line
        ? colorLine({ text: fit({ text: line.text, width: columns }), kind: line.kind })
        : colorLine({ text: "", kind: "plain" }),
    );
  }

  lines.push(colorLine({ text: "", kind: "plain" }));
  lines.push(colorLine({ text: fit({ text: summary(state), width: columns }), kind: "title" }));
  lines.push(colorLine({ text: fit({ text: state.notice, width: columns }), kind: "notice" }));
  lines.push(colorLine({ text: fit({ text: HINT, width: columns }), kind: "hint" }));

  return { frame: `\x1b[H${lines.join("\r\n")}\x1b[J`, scroll: nextScroll };
}

function bodyLines({
  choices,
  state,
  columns,
}: {
  choices: PickerChoices;
  state: PickerState;
  columns: number;
}): PickerLine[] {
  const rows = pickerRows(choices);
  const idWidth = Math.min(Math.max(...[...choices.tasks, ...choices.configs].map((item) => item.id.length), 8), 32);
  const lines: PickerLine[] = [];
  const checkedTasks = state.tasks.filter(Boolean).length;
  const checkedConfigs = state.configs.filter(Boolean).length;

  lines.push(header(`Tasks  ${checkedTasks}/${choices.tasks.length}`));
  rows.forEach((row, rowIndex) => {
    if (row.kind === "config" && row.index === 0) {
      lines.push(gap(), header(`Configs  ${checkedConfigs}/${choices.configs.length}`));
    }

    if (row.kind === "repeats") {
      lines.push(gap(), header("Settings"));
    }

    const text = rowText({ choices, state, row, idWidth, columns });
    lines.push({
      text: `${rowIndex === state.cursor ? "›" : " "} ${text}`,
      kind: rowIndex === state.cursor ? "selected" : "plain",
      row: rowIndex,
    });
  });

  return lines;
}

function rowText({
  choices,
  state,
  row,
  idWidth,
  columns,
}: {
  choices: PickerChoices;
  state: PickerState;
  row: PickerRow;
  idWidth: number;
  columns: number;
}): string {
  if (row.kind === "task" || row.kind === "config") {
    const items = row.kind === "task" ? choices.tasks : choices.configs;
    const checked = row.kind === "task" ? state.tasks : state.configs;

    return itemText({ item: items[row.index], checked: checked[row.index] ?? false, idWidth, columns });
  }

  if (row.kind === "repeats") {
    return `${"Repeats".padEnd(14)}‹ ${state.repeats} ›  runs per task × config`;
  }

  if (row.kind === "timeoutMin") {
    return `${"Timeout".padEnd(14)}‹ ${state.timeoutMin} ›  minutes per claude session`;
  }

  return `${"gclient sync".padEnd(14)}${box(state.sync)}  run gclient sync -D after each checkout`;
}

function itemText({
  item,
  checked,
  idWidth,
  columns,
}: {
  item: PickerItem | undefined;
  checked: boolean;
  idWidth: number;
  columns: number;
}): string {
  if (!item) {
    return "";
  }

  const id = fit({ text: item.id, width: idWidth });

  return `${box(checked)} ${id}  ${fit({ text: item.detail, width: Math.max(columns - idWidth - 10, 0) }).trimEnd()}`;
}

function scrollFor({
  body,
  cursor,
  scroll,
  height,
}: {
  body: PickerLine[];
  cursor: number;
  scroll: number;
  height: number;
}): number {
  const cursorLine = Math.max(
    body.findIndex((line) => line.row === cursor),
    0,
  );
  // Show the section header above the first row of a section when scrolling up to it.
  const topLine = body[cursorLine - 1]?.row === null ? cursorLine - 1 : cursorLine;
  let nextScroll = scroll;

  if (topLine < nextScroll) {
    nextScroll = topLine;
  }

  if (cursorLine >= nextScroll + height) {
    nextScroll = cursorLine - height + 1;
  }

  return Math.min(Math.max(nextScroll, 0), Math.max(body.length - height, 0));
}

function summary(state: PickerState): string {
  const tasks = state.tasks.filter(Boolean).length;
  const configs = state.configs.filter(Boolean).length;

  return `${plural({ count: tasks, noun: "task" })} × ${plural({ count: configs, noun: "config" })} × ${plural({ count: state.repeats, noun: "repeat" })} = ${plural({ count: runCount(state), noun: "run" })}`;
}

function plural({ count, noun }: { count: number; noun: string }): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function box(checked: boolean): string {
  return checked ? "[x]" : "[ ]";
}

function header(text: string): PickerLine {
  return { text, kind: "title", row: null };
}

function gap(): PickerLine {
  return { text: "", kind: "plain", row: null };
}
