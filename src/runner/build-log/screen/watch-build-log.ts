import type { Database } from "bun:sqlite";
import process from "node:process";
import { latestRunBuild } from "../../../db/db";
import { agentIsPaused } from "../../claude/session/agent-pause";
import type { AgentBuildView } from "../../../db/db.types";
import { applyLogKey, buildLogWanted, createLogView, logLineCount, syncLogView } from "../log-view";
import type { LogView } from "../log-view.types";
import { renderBuildLog } from "../render-build-log";
import { openLogTerminal } from "./log-terminal";
import type { BuildLogWatch } from "./watch-build-log.types";

const POLL_MS = 200;

/**
 * Follows this run's agent build and, once one is running, takes the terminal to stream its log.
 * Esc hides it until the next build. Ctrl-C still stops the benchmark.
 * A non-terminal returns a watch that does nothing, so a piped run is unchanged.
 */
export function watchAgentBuildLog({
  db,
  runId,
  signal,
}: {
  db: Database;
  runId: string;
  signal: AbortSignal;
}): BuildLogWatch {
  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
    return { async stop() {} };
  }

  return follow({ db, runId, signal });
}

function follow({ db, runId, signal }: { db: Database; runId: string; signal: AbortSignal }): BuildLogWatch {
  let stopped = false;
  let view: LogView = createLogView();
  let shownBuildId: number | null = null;
  let dismissedBuildId: number | null = null;
  const terminal = openLogTerminal({
    onKey: (key) => onKey(key),
    onResize: () => tick(),
  });

  const tick = () => {
    if (stopped) {
      return;
    }

    const build = readBuild();

    if (build === undefined) {
      return;
    }

    if (build != null) {
      view = syncLogView({ view, build });
    }

    const wanted = buildLogWanted({
      buildId: build?.id ?? null,
      dismissedBuildId,
      shownBuildId,
      status: build?.status ?? null,
    });

    if (!wanted || build == null) {
      terminal.hide();

      return;
    }

    shownBuildId = build.id;
    terminal.show();
    const { rows, columns } = terminalSize();
    terminal.paint(
      renderBuildLog({
        build,
        cursor: view.cursor,
        above: view.above,
        rows,
        columns,
        chrome: "run",
        agentPaused: agentIsPaused(build.run_id),
      }),
    );
  };

  const onKey = (key: string) => {
    if (key === "\x1b") {
      dismissedBuildId = shownBuildId;
      terminal.hide();

      return;
    }

    const { rows } = terminalSize();
    view = applyLogKey({ view, key, pageSize: Math.max(1, rows - 3), lineCount: logLineCount(view) });
    tick();
  };

  const readBuild = (): AgentBuildView | null | undefined => {
    try {
      return latestRunBuild({ db, runId });
    } catch {
      // A locked database skips this tick. The next one reads the log.
      return undefined;
    }
  };

  const done = (async () => {
    try {
      while (!stopped) {
        tick();
        await Bun.sleep(POLL_MS);
      }
    } finally {
      terminal.hide();
    }
  })();

  const onAbort = () => {
    stopped = true;
    terminal.hide();
  };
  signal.addEventListener("abort", onAbort, { once: true });

  return {
    async stop() {
      stopped = true;
      signal.removeEventListener("abort", onAbort);
      await done;
    },
  };
}

function terminalSize(): { rows: number; columns: number } {
  return {
    rows: process.stdout.rows ?? 24,
    columns: process.stdout.columns ?? 80,
  };
}
