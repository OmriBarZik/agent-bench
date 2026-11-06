import { currentAgentBuild, openDb } from "../../../db/db";
import { agentIsPaused } from "../../claude/session/agent-pause";
import type { AgentBuildView } from "../../../db/db.types";
import type { TuiControls, TuiScreen } from "../../../tui/open-tui.types";
import { applyLogKey, createLogView, logLineCount, syncLogView } from "../log-view";
import type { LogView } from "../log-view.types";
import { renderBuildLog } from "../render-build-log";

const POLL_MS = 200;
/** A paint this recent means the Build tab is the one on screen, so the poll may draw again. */
const SHOWN_MS = 1000;

/**
 * The Build tab. It follows the newest agent build, a running one ahead of a finished one,
 * and streams that build's log. Esc is left to the TUI, which quits.
 */
export function createBuildLogScreen({ controls }: { controls: TuiControls }): TuiScreen {
  let view = createLogView();
  let build: AgentBuildView | null = null;
  let shownAt = 0;
  let database: ReturnType<typeof openDb> | null = null;

  const refresh = () => {
    database ??= openDb();
    build = currentAgentBuild(database);
    view = syncLogView({ view, build });
  };

  try {
    refresh();
  } catch {
    // The poll retries. Opening the database must not stop the TUI from drawing.
  }

  const timer = setInterval(() => {
    if (controls.isClosed()) {
      clearInterval(timer);
      database?.close();
      database = null;

      return;
    }

    const before = fingerprint({ view, build });

    try {
      refresh();
    } catch {
      // A locked database skips this tick. The next one reads the log.
      return;
    }

    if (fingerprint({ view, build }) === before || Date.now() - shownAt > SHOWN_MS) {
      return;
    }

    controls.repaint();
  }, POLL_MS);
  timer.unref();

  return {
    render: (size) => {
      shownAt = Date.now();

      return renderBuildLog({
        build,
        cursor: view.cursor,
        above: view.above,
        rows: size.rows,
        columns: size.columns,
        chrome: "tab",
        agentPaused: agentIsPaused(build?.run_id ?? null),
      });
    },
    onKey: (key) => {
      const pageSize = Math.max(1, controls.size().rows - 3);
      view = applyLogKey({ view, key, pageSize, lineCount: logLineCount(view) });
    },
    onEscape: () => false,
    onInterrupt: () => false,
    onResize: () => {},
    isBusy: () => false,
  };
}

function fingerprint({ view, build }: { view: LogView; build: AgentBuildView | null }): string {
  const paused = agentIsPaused(build?.run_id ?? null);

  return `${build?.id ?? ""}:${build?.status ?? ""}:${paused}:${view.cursor.offset}:${view.cursor.pending}:${view.cursor.lines.length}:${view.above}`;
}
