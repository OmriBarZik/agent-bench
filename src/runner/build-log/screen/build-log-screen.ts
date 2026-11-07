import { currentAgentBuild, openDb } from "../../../db/db";
import type { AgentBuildView } from "../../../db/db.types";
import type { ChromiumJobController } from "../../../start/jobs/chromium-job.types";
import type { TuiControls, TuiScreen } from "../../../tui/open-tui.types";
import { agentIsPaused } from "../../claude/session/agent-pause";
import { applyLogKey, createLogView, logLineCount, syncLogView } from "../log-view";
import type { LogView } from "../log-view.types";
import { renderBuildLog } from "../render-build-log";

const POLL_MS = 200;
/** A paint this recent means the Build tab is the one on screen, so the poll may draw again. */
const SHOWN_MS = 1000;

/**
 * The Build tab. Prefers an inspect build's log while that job owns the Chromium slot;
 * otherwise follows the newest agent build. Esc is left to the TUI, which quits.
 */
export function createBuildLogScreen({
  controls,
  jobs,
}: {
  controls: TuiControls;
  jobs?: ChromiumJobController;
}): TuiScreen {
  let view = createLogView();
  let build: AgentBuildView | null = null;
  let shownAt = 0;
  let database: ReturnType<typeof openDb> | null = null;

  const refresh = () => {
    const inspect = inspectBuildView(jobs);
    const agent = readAgentBuild();
    // An inspect log wins while that job runs, and after it finishes until an agent build is active.
    build = inspect != null && (jobs?.status().kind === "build" || agent?.status !== "building") ? inspect : agent;
    view = syncLogView({ view, build });
  };

  const readAgentBuild = (): AgentBuildView | null => {
    database ??= openDb();

    return currentAgentBuild(database);
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

function inspectBuildView(jobs: ChromiumJobController | undefined): AgentBuildView | null {
  if (!jobs) {
    return null;
  }

  const status = jobs.status();

  if (status.logPath == null || status.logId == null) {
    return null;
  }

  if (status.kind !== "build" && status.kind !== "idle") {
    return null;
  }

  return {
    id: -status.logId,
    run_id: null,
    build_number: status.logId,
    status: status.kind === "build" ? (status.stopping ? "cancelled" : "building") : "ok",
    log_path: status.logPath,
    task_id: null,
    config_id: null,
    repeat: null,
  };
}

function fingerprint({ view, build }: { view: LogView; build: AgentBuildView | null }): string {
  const paused = agentIsPaused(build?.run_id ?? null);

  return `${build?.id ?? ""}:${build?.status ?? ""}:${paused}:${view.cursor.offset}:${view.cursor.pending}:${view.cursor.lines.length}:${view.above}`;
}
