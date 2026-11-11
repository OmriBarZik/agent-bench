import { linesOfLog } from "../../runner/build-log/log-cursor";
import { colorLine, fit, fitEnd } from "../render/terminal-text";
import type { LiveLogViewer } from "./live-log.types";

/** The live agent log over the Runs list: the run, the log file, its lines, and whether it follows new ones. */
export function renderLiveLog({
  viewer,
  rows,
  columns,
}: {
  viewer: LiveLogViewer;
  rows: number;
  columns: number;
}): string {
  const width = Math.max(columns, 1);
  const logRows = Math.max(0, rows - 3);
  const logged = linesOfLog(viewer.view.cursor);
  const lines = logged.length === 0 ? ["Waiting for the agent's first message…"] : logged;
  const hidden = Math.min(viewer.view.above, Math.max(0, lines.length - 1));
  const end = Math.max(0, lines.length - hidden);
  const window = lines.slice(Math.max(0, end - logRows), end);
  const painted = [
    colorLine({ text: fit({ text: `Live agent log · ${viewer.runId}`, width }), kind: "title" }),
    colorLine({ text: fit({ text: fitEnd({ text: viewer.path, width }), width }), kind: "dim" }),
    ...window.map((line) => colorLine({ text: fit({ text: line, width }), kind: "plain" })),
  ];

  while (painted.length < logRows + 2) {
    painted.push(colorLine({ text: "", kind: "plain" }));
  }

  if (rows > 2) {
    painted.push(footerLine({ hidden, unseen: viewer.view.unseen, width }));
  }

  return painted.slice(0, rows).join("\r\n");
}

function footerLine({ hidden, unseen, width }: { hidden: number; unseen: number; width: number }): string {
  const keys = "↑↓ pgup/pgdn scroll · esc back to runs";

  if (hidden > 0) {
    const fresh = unseen > 0 ? `${unseen} new line${unseen === 1 ? "" : "s"} · ` : "";
    const text = `▲ PAUSED ${hidden} lines up · ${fresh}end jumps to live · ${keys}`;

    return colorLine({ text: fit({ text, width }), kind: "alert" });
  }

  return colorLine({ text: fit({ text: `● LIVE · following the agent · ${keys}`, width }), kind: "live" });
}
