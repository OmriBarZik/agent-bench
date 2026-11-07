import { listAgentBuilds, openDb } from "../../../db/db";
import type { AgentBuildView } from "../../../db/db.types";
import type { ChromiumJobController } from "../../../start/jobs/chromium-job.types";
import type { TuiControls, TuiScreen } from "../../../tui/open-tui.types";
import { agentIsPaused } from "../../claude/session/agent-pause";
import { applyLogKey, createLogView, logLineCount, syncLogView } from "../log-view";
import type { LogView } from "../log-view.types";
import { renderBuildLog } from "../render-build-log";
import {
  applyBuildListKey,
  emptyBuildList,
  renderBuildList,
  scrollBuildList,
  stepBuildSelection,
  syncBuildList,
} from "./build-list";
import type { BuildListState } from "./build-list.types";

const POLL_MS = 200;
/** A paint this recent means the Build tab is the one on screen, so the poll may draw again. */
const SHOWN_MS = 1000;
const BUILD_LIST_LIMIT = 100;

/**
 * The Build tab: a list of past and present agent builds, plus the live inspect-build log when one
 * is running. Enter opens a build's log; esc returns to the list. Tab and shift-tab still switch TUI tabs.
 */
export function createBuildLogScreen({
  controls,
  jobs,
}: {
  controls: TuiControls;
  jobs?: ChromiumJobController;
}): TuiScreen {
  let list = emptyBuildList();
  let view = createLogView();
  let shownAt = 0;
  let database: ReturnType<typeof openDb> | null = null;
  let openedLive = false;

  const selectedBuild = (): AgentBuildView | null => list.builds[list.selected] ?? null;

  const refresh = () => {
    database ??= openDb();
    const agentBuilds = listAgentBuilds({ db: database, limit: BUILD_LIST_LIMIT });
    const inspect = inspectBuildView(jobs);
    const builds = inspect ? mergeInspect({ inspect, builds: agentBuilds }) : agentBuilds;
    const beforeId = selectedBuild()?.id ?? null;
    list = syncBuildList({ state: list, builds });
    const pageSize = Math.max(controls.size().rows - 2, 1);
    list = scrollBuildList({ state: list, pageSize });

    // First time a live build appears while following, open its log (same as the old single-build view).
    if (list.followLive && !openedLive) {
      const live = list.builds.find((build) => build.status === "building");

      if (live) {
        list = { ...list, mode: "log", selected: list.builds.findIndex((build) => build.id === live.id) };
        openedLive = true;
      }
    }

    if (list.mode === "log") {
      const build = selectedBuild();

      if (build == null) {
        list = { ...list, mode: "list" };
        view = createLogView();
      } else {
        if (beforeId !== build.id) {
          view = createLogView();
        }

        view = syncLogView({ view, build });
      }
    }
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

    const before = fingerprint({ list, view });

    try {
      refresh();
    } catch {
      // A locked database skips this tick. The next one reads the log.
      return;
    }

    if (fingerprint({ list, view }) === before || Date.now() - shownAt > SHOWN_MS) {
      return;
    }

    controls.repaint();
  }, POLL_MS);
  timer.unref();

  return {
    render: (size) => {
      shownAt = Date.now();
      const pageSize = Math.max(size.rows - 2, 1);
      list = scrollBuildList({ state: list, pageSize });

      if (list.mode === "list") {
        return renderBuildList({ state: list, rows: size.rows, columns: size.columns });
      }

      const build = selectedBuild();

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
      if (list.mode === "list") {
        const pageSize = Math.max(controls.size().rows - 2, 1);
        list = applyBuildListKey({ state: list, key, pageSize });
        list = scrollBuildList({ state: list, pageSize });

        if (list.mode === "log") {
          view = createLogView();
          const build = selectedBuild();

          if (build) {
            view = syncLogView({ view, build });
          }
        }

        return;
      }

      if (key === "\x1b[D" || key === "h") {
        list = stepBuildSelection({ state: list, delta: -1 });
        view = createLogView();
        const build = selectedBuild();

        if (build) {
          view = syncLogView({ view, build });
        }

        return;
      }

      if (key === "\x1b[C" || key === "l") {
        list = stepBuildSelection({ state: list, delta: 1 });
        view = createLogView();
        const build = selectedBuild();

        if (build) {
          view = syncLogView({ view, build });
        }

        return;
      }

      const pageSize = Math.max(1, controls.size().rows - 3);
      view = applyLogKey({ view, key, pageSize, lineCount: logLineCount(view) });
    },
    onEscape: () => {
      if (list.mode === "log") {
        list = { ...list, mode: "list" };

        return true;
      }

      return false;
    },
    onInterrupt: () => false,
    onResize: () => {},
    isBusy: () => false,
  };
}

function mergeInspect({ inspect, builds }: { inspect: AgentBuildView; builds: AgentBuildView[] }): AgentBuildView[] {
  const without = builds.filter((build) => build.id !== inspect.id);

  return [inspect, ...without];
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
    started_at: null,
    task_id: null,
    config_id: null,
    repeat: null,
  };
}

function fingerprint({ list, view }: { list: BuildListState; view: LogView }): string {
  const build = list.builds[list.selected];
  const paused = agentIsPaused(build?.run_id ?? null);

  return `${list.mode}:${list.selected}:${list.followLive}:${list.builds.map((item) => `${item.id}:${item.status}`).join(",")}:${paused}:${view.cursor.offset}:${view.cursor.pending}:${view.cursor.lines.length}:${view.above}`;
}
