import { colorLine, fit } from "../../inspect/render/terminal-text";
import type { LineKind } from "../../inspect/render/terminal-text.types";
import { detailLines, runsText, statusWord } from "./detail-lines";
import type { ConfigSetup, SetupReport, SetupsFrame } from "./load-setups.types";

const HINT = "↑↓ move   r refresh   esc quit";

/** Draws the Setups tab. The list scrolls so the highlighted config stays on screen. */
export function renderSetups({
  report,
  selected,
  scroll,
  rows,
  columns,
}: {
  report: SetupReport;
  selected: number;
  scroll: number;
  rows: number;
  columns: number;
}): SetupsFrame {
  const room = Math.max(rows - 5, 1);
  let detailHeight = Math.min(12, Math.floor(room / 3));
  let listHeight = room - detailHeight;

  if (listHeight < 1) {
    listHeight = 1;
    detailHeight = Math.max(room - listHeight, 0);
  }

  const nextScroll = scrollFor({ selected, scroll, height: listHeight, count: report.configs.length });
  const lines: string[] = [
    colorLine({ text: fit({ text: heading(report), width: columns }), kind: "title" }),
    colorLine({ text: fit({ text: sharedLine(report), width: columns }), kind: sharedKind(report) }),
    colorLine({ text: "", kind: "plain" }),
  ];

  for (let index = 0; index < listHeight; index++) {
    const configIndex = nextScroll + index;
    const config = report.configs[configIndex];
    const text = config ? listLine({ report, config, selected }) : "";
    const kind = config && configIndex === selected ? "selected" : "plain";
    lines.push(colorLine({ text: fit({ text, width: columns }), kind }));
  }

  lines.push(colorLine({ text: "", kind: "plain" }));

  for (const line of detailLines({ config: report.configs[selected], height: detailHeight, columns })) {
    lines.push(colorLine({ text: fit({ text: line.text, width: columns }), kind: line.kind }));
  }

  lines.push(colorLine({ text: fit({ text: HINT, width: columns }), kind: "hint" }));

  return { body: lines.join("\r\n"), scroll: nextScroll };
}

function heading(report: SetupReport): string {
  const missing = report.configs.filter((config) => config.status === "missing").length;
  const ready = report.configs.filter((config) => config.status === "ready").length;
  const undeclared = report.configs.filter((config) => config.status === "undeclared").length;
  const invalid = report.configs.filter((config) => config.status === "invalid").length;
  const neverRun = report.configs.filter((config) => config.runs === 0).length;
  const parts = [`Setups  ${missing} missing`, `${ready} ready`, `${neverRun} never run`];

  if (undeclared > 0) {
    parts.push(`${undeclared} no setup file`);
  }

  if (invalid > 0) {
    parts.push(`${invalid} invalid`);
  }

  return parts.join(" · ");
}

function sharedLine(report: SetupReport): string {
  const parts = report.shared.map((check) => `${check.label} ${check.ok ? "ok" : "missing"}`);

  return `shared  ${parts.join(" · ")}`;
}

function sharedKind(report: SetupReport): LineKind {
  if (report.shared.some((check) => !check.ok)) {
    return "notice";
  }

  return "dim";
}

function listLine({
  report,
  config,
  selected,
}: {
  report: SetupReport;
  config: ConfigSetup;
  selected: number;
}): string {
  const idWidth = Math.max(...report.configs.map((item) => item.configId.length), 8);
  const index = report.configs.indexOf(config);
  const marker = index === selected ? "›" : " ";

  return `${marker} ${config.configId.padEnd(idWidth)}  ${statusWord(config.status).padEnd(8)}  ${runsText(config.runs)}`;
}

function scrollFor({
  selected,
  scroll,
  height,
  count,
}: {
  selected: number;
  scroll: number;
  height: number;
  count: number;
}): number {
  let next = scroll;

  if (selected < next) {
    next = selected;
  }

  if (selected >= next + height) {
    next = selected - height + 1;
  }

  return Math.min(Math.max(next, 0), Math.max(count - height, 0));
}
