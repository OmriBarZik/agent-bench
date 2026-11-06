import type { AgentBuildView } from "../../db/db.types";
import { linesOfLog } from "./log-cursor";
import type { LogCursor } from "./log-cursor.types";

/** Where the log is drawn. The tab quits with esc; the run hides the screen and keeps the benchmark going. */
export function renderBuildLog({
  build,
  cursor,
  above,
  rows,
  columns,
  chrome,
}: {
  build: AgentBuildView | null;
  cursor: LogCursor;
  above: number;
  rows: number;
  columns: number;
  chrome: "tab" | "run";
}): string {
  const width = Math.max(columns, 1);
  const logRows = Math.max(0, rows - 3);
  const logged = linesOfLog(cursor);
  const lines = logged.length === 0 && build != null ? ["Waiting for output…"] : logged;
  const hidden = Math.min(above, Math.max(0, lines.length - 1));
  const end = Math.max(0, lines.length - hidden);
  const window = lines.slice(Math.max(0, end - logRows), end);
  const painted = [headerLine({ build, width }), detailLine({ build, width }), ...pad(window, logRows, width)];

  if (rows > 2) {
    painted.push(footerLine({ chrome, following: hidden === 0, width, status: build?.status ?? null }));
  }

  return painted.slice(0, rows).join("\r\n");
}

function headerLine({ build, width }: { build: AgentBuildView | null; width: number }): string {
  if (build == null) {
    return paint({ text: fit({ text: "Agent build", width }), kind: "title" });
  }

  const status = build.status === "ok" ? "passed" : build.status;
  const text = `Build ${build.build_number} · ${status} · ${runLabel(build)}`;

  return paint({ text: fit({ text, width }), kind: "title" });
}

function detailLine({ build, width }: { build: AgentBuildView | null; width: number }): string {
  if (build == null) {
    return paint({ text: fit({ text: "Waiting for an agent to request a remote build.", width }), kind: "dim" });
  }

  if (build.log_path == null) {
    return paint({ text: fit({ text: "This build has no log file.", width }), kind: "dim" });
  }

  return paint({ text: fitEnd({ text: build.log_path, width }), kind: "dim" });
}

function footerLine({
  chrome,
  following,
  width,
  status,
}: {
  chrome: "tab" | "run";
  following: boolean;
  width: number;
  status: AgentBuildView["status"] | null;
}): string {
  const place = following ? "following" : "scrolled up";
  const stream = status === "building" && following ? "streaming" : place;
  const keys = chrome === "run" ? "esc hides · ctrl-c stops the run" : "esc quits";
  const text = `↑↓ scrolls · end follows · ${stream} · ${keys}`;

  return paint({ text: fit({ text, width }), kind: "hint" });
}

function runLabel(build: AgentBuildView): string {
  if (build.task_id == null || build.config_id == null) {
    return build.run_id ?? "manual";
  }

  return `${build.task_id} × ${build.config_id} r${build.repeat ?? 0}`;
}

function pad(lines: string[], height: number, width: number): string[] {
  const painted = lines.map((line) => paint({ text: fit({ text: line, width }), kind: "plain" }));

  while (painted.length < height) {
    painted.push(paint({ text: "", kind: "plain" }));
  }

  return painted;
}

function fit({ text, width }: { text: string; width: number }): string {
  if (text.length <= width) {
    return text.padEnd(width);
  }

  if (width <= 1) {
    return "…";
  }

  return `${text.slice(0, width - 1)}…`;
}

function fitEnd({ text, width }: { text: string; width: number }): string {
  if (text.length <= width) {
    return text.padEnd(width);
  }

  if (width <= 1) {
    return "…";
  }

  return `…${text.slice(text.length - (width - 1))}`.padEnd(width);
}

function paint({ text, kind }: { text: string; kind: "title" | "dim" | "hint" | "plain" }): string {
  if (kind === "title") {
    return `\x1b[1m${text}\x1b[0m\x1b[K`;
  }

  if (kind === "dim" || kind === "hint") {
    return `\x1b[2m${text}\x1b[0m\x1b[K`;
  }

  return `${text}\x1b[K`;
}
