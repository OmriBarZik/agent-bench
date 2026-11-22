import { colorLine, fit } from "../../inspect/render/terminal-text";
import { isChecked, SECTION_TITLES } from "./export-form";
import type { ExportListLine, ExportFrame, ExportView } from "./render-export.types";

const HINT = "↑↓ move   space check   enter export   c copy bench-export.md   o open folder   r reload   esc quit";

/** Draws the Export tab. The list scrolls so the highlighted row stays on screen. */
export function renderExport({
  view,
  rows,
  columns,
}: {
  view: ExportView;
  rows: number;
  columns: number;
}): ExportFrame {
  const listLines = toListLines(view);
  const height = Math.max(rows - 5, 1);
  const selectedLine = listLines.findIndex((line) => line.optionIndex === view.selected);
  const scroll = scrollFor({ selectedLine, scroll: view.scroll, height, count: listLines.length });
  const heading = `Export  ${view.matching} of ${view.total} runs match · writes exports/<time>/ with bench-export.md to paste into an AI chat`;
  const lines = [
    colorLine({ text: fit({ text: heading, width: columns }), kind: "title" }),
    colorLine({ text: "", kind: "plain" }),
  ];

  for (let index = 0; index < height; index++) {
    const line = listLines[scroll + index];
    lines.push(line ? drawListLine({ view, line, columns }) : colorLine({ text: "", kind: "plain" }));
  }

  lines.push(colorLine({ text: "", kind: "plain" }));
  lines.push(colorLine({ text: fit({ text: view.notice, width: columns }), kind: view.notice ? "notice" : "plain" }));
  lines.push(colorLine({ text: fit({ text: HINT, width: columns }), kind: "hint" }));

  return { body: lines.join("\r\n"), scroll };
}

function toListLines(view: ExportView): ExportListLine[] {
  const lines: ExportListLine[] = [];

  view.options.forEach((option, optionIndex) => {
    if (optionIndex === 0 || view.options[optionIndex - 1]!.section !== option.section) {
      if (lines.length > 0) {
        lines.push({ heading: "", optionIndex: null });
      }

      lines.push({ heading: SECTION_TITLES[option.section], optionIndex: null });
    }

    lines.push({ heading: null, optionIndex });
  });

  return lines;
}

function drawListLine({ view, line, columns }: { view: ExportView; line: ExportListLine; columns: number }): string {
  if (line.optionIndex === null) {
    return colorLine({ text: fit({ text: line.heading ?? "", width: columns }), kind: "dim" });
  }

  const option = view.options[line.optionIndex]!;
  const checked = isChecked({ form: view.form, option });
  const box = option.section === "compareAgainst" ? (checked ? "(•)" : "( )") : checked ? "[x]" : "[ ]";
  const marker = line.optionIndex === view.selected ? "›" : " ";
  const text = `${marker} ${box} ${option.label}${option.detail ? `  ${option.detail}` : ""}`;

  return colorLine({
    text: fit({ text, width: columns }),
    kind: line.optionIndex === view.selected ? "selected" : "plain",
  });
}

function scrollFor({
  selectedLine,
  scroll,
  height,
  count,
}: {
  selectedLine: number;
  scroll: number;
  height: number;
  count: number;
}): number {
  let next = scroll;

  // Keep the section heading above the first row of a section in view.
  if (selectedLine - 1 < next) {
    next = Math.max(selectedLine - 1, 0);
  }

  if (selectedLine >= next + height) {
    next = selectedLine - height + 1;
  }

  return Math.min(Math.max(next, 0), Math.max(count - height, 0));
}
