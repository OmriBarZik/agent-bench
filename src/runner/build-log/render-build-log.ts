import type { AgentBuildView } from "../../db/db.types";
import { colorLine, fit, fitEnd } from "../../inspect/render/terminal-text";
import { AGENT_PAUSED_LINE } from "../claude/session/agent-pause";
import { linesOfLog, producedLines } from "./log-cursor";
import type { LogCursor } from "./log-cursor.types";

/** Where the log is drawn. The tab quits with esc; the run hides the screen and keeps the benchmark going. */
export function renderBuildLog({
  build,
  cursor,
  above,
  unseen = 0,
  rows,
  columns,
  chrome,
  agentPaused = false,
}: {
  build: AgentBuildView | null;
  cursor: LogCursor;
  above: number;
  /** Lines that arrived below the window while the user was scrolled up. */
  unseen?: number;
  rows: number;
  columns: number;
  chrome: "tab" | "run";
  /** True while wait_build has stopped the agent. The notice stays on screen as the log scrolls. */
  agentPaused?: boolean;
}): string {
  const width = Math.max(columns, 1);
  const logRows = Math.max(0, rows - 3);
  const logged = linesOfLog(cursor);
  const lines = logged.length === 0 && build != null ? ["Waiting for output…"] : logged;
  const hidden = Math.min(above, Math.max(0, lines.length - 1));
  const end = Math.max(0, lines.length - hidden);
  const window = lines.slice(Math.max(0, end - logRows), end);
  const painted = [
    headerLine({ build, width, agentPaused, lineCount: producedLines(cursor) }),
    detailLine({ build, width, agentPaused }),
    ...pad(window, logRows, width),
  ];

  if (rows > 2) {
    painted.push(footerLine({ chrome, hidden, unseen, width, status: build?.status ?? null }));
  }

  return painted.slice(0, rows).join("\r\n");
}

function headerLine({
  build,
  width,
  agentPaused,
  lineCount,
}: {
  build: AgentBuildView | null;
  width: number;
  agentPaused: boolean;
  lineCount: number;
}): string {
  if (build == null) {
    return colorLine({ text: fit({ text: "Agent build", width }), kind: "title" });
  }

  const status = build.status === "ok" ? "passed" : build.status;
  const paused = agentPaused ? " · agent paused" : "";
  const text = `Build ${build.build_number} · ${status}${paused} · ${runLabel(build)} · ${lineCount} lines`;

  return colorLine({ text: fit({ text, width }), kind: "title" });
}

function detailLine({
  build,
  width,
  agentPaused,
}: {
  build: AgentBuildView | null;
  width: number;
  agentPaused: boolean;
}): string {
  if (agentPaused && build != null) {
    return colorLine({ text: fit({ text: AGENT_PAUSED_LINE, width }), kind: "title" });
  }

  if (build == null) {
    return colorLine({ text: fit({ text: "Waiting for an agent to request a remote build.", width }), kind: "dim" });
  }

  if (build.log_path == null) {
    return colorLine({ text: fit({ text: "This build has no log file.", width }), kind: "dim" });
  }

  return colorLine({ text: fit({ text: fitEnd({ text: build.log_path, width }), width }), kind: "dim" });
}

/** Green while a running build streams at the tail, yellow while scrolled up so new output is never missed. */
function footerLine({
  chrome,
  hidden,
  unseen,
  width,
  status,
}: {
  chrome: "tab" | "run";
  hidden: number;
  unseen: number;
  width: number;
  status: AgentBuildView["status"] | null;
}): string {
  const keys = chrome === "run" ? "esc hides · ctrl-c stops the run" : "←→ builds · esc list · tab switches";

  if (hidden > 0) {
    const fresh = unseen > 0 ? `${unseen} new line${unseen === 1 ? "" : "s"} · ` : "";
    const text = `▲ PAUSED ${hidden} lines up · ${fresh}end jumps to live · ↑↓ scrolls · ${keys}`;

    return colorLine({ text: fit({ text, width }), kind: "alert" });
  }

  if (status === "building") {
    const text = `● LIVE · following new output · ↑↓ scrolls · ${keys}`;

    return colorLine({ text: fit({ text, width }), kind: "live" });
  }

  const text = `■ at the end · ↑↓ scrolls · ${keys}`;

  return colorLine({ text: fit({ text, width }), kind: "hint" });
}

function runLabel(build: AgentBuildView): string {
  if (build.task_id == null || build.config_id == null) {
    return build.run_id ?? "manual";
  }

  return `${build.task_id} × ${build.config_id} r${build.repeat ?? 0}`;
}

function pad(lines: string[], height: number, width: number): string[] {
  const painted = lines.map((line) => colorLine({ text: fit({ text: line, width }), kind: "plain" }));

  while (painted.length < height) {
    painted.push(colorLine({ text: "", kind: "plain" }));
  }

  return painted;
}
