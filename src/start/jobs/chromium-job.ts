import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { clearAllChromiumAppCopies, clearChromiumAppCopies } from "../../inspect/build/app/clear-app";
import { clearAppNotice, clearAppProgressNotice } from "../../inspect/build/app/clear-progress";
import type { BuildFinish, BuildWork } from "../../inspect/build/build-session.types";
import { checkOutRun } from "../../inspect/checkout/checkout-run";
import type { RunChoice } from "../../inspect/list/select-state.types";
import { RUNS_DIR } from "../../paths";
import type {
  ChromiumJobController,
  ChromiumJobHooks,
  ChromiumJobStatus,
  ClearAppsRequest,
  StartMatrixRequest,
} from "./chromium-job.types";
import { openMatrixLog } from "./matrix-log";
import type { MatrixLog } from "./matrix-log.types";
import { runMatrix } from "./run-matrix";
import type { RunMatrixResult } from "./run-matrix.types";

const INSPECT_LOG_DIR = join(RUNS_DIR, "_inspect-builds");
const MATRIX_PANEL_LINES = 10;

/**
 * One Chromium-touching job at a time while the start TUI is open.
 * Matrix, inspect builds, checkout, and Chromium.app deletes share the slot; a second start is refused.
 */
export function createChromiumJobController({
  force,
  onChange,
  onBuildLog,
  onBuildFinish,
}: ChromiumJobHooks & { force: boolean }): ChromiumJobController {
  let abort: AbortController | null = null;
  let status: ChromiumJobStatus = idleStatus();
  let lastMatrixResult: RunMatrixResult | null = null;
  let lastMatrixLogPath: string | null = null;
  let matrixLog: MatrixLog | null = null;
  let nextLogId = 1;

  const setStatus = (next: ChromiumJobStatus) => {
    status = next;
    onChange();
  };

  const busyNotice = (): string => {
    if (status.kind === "idle") {
      return "a job is already running";
    }

    if (status.stopping) {
      return `stopping the ${jobKindLabel(status.kind)}…`;
    }

    return `a ${jobKindLabel(status.kind)} is already running`;
  };

  const begin = (kind: ChromiumJobStatus["kind"], label: string, logPath: string | null): AbortSignal | null => {
    if (status.kind !== "idle" || abort) {
      return null;
    }

    abort = new AbortController();
    setStatus({
      kind,
      label,
      logPath,
      stopping: false,
      logId: logPath ? nextLogId++ : null,
      recentLines: kind === "matrix" ? [] : undefined,
    });

    return abort.signal;
  };

  const settle = (label: string) => {
    abort = null;
    setStatus({
      kind: "idle",
      label,
      logPath: status.logPath,
      stopping: false,
      logId: status.logId,
      recentLines: matrixLog?.recent(MATRIX_PANEL_LINES),
    });
  };

  return {
    status: () => status,
    lastMatrix: () => lastMatrixResult,
    lastMatrixLogPath: () => lastMatrixLogPath,
    cancel: () => {
      if (!abort || status.kind === "idle") {
        return false;
      }

      setStatus({ ...status, stopping: true, label: `stopping ${jobKindLabel(status.kind)}…` });
      abort.abort();

      return true;
    },
    startMatrix: (request: StartMatrixRequest) => {
      const log = openMatrixLog();
      matrixLog = log;
      lastMatrixLogPath = log.path;
      const signal = begin("matrix", matrixLabel({ index: 0, total: 0 }), log.path);

      if (!signal) {
        return busyNotice();
      }

      log.append(`matrix started · log ${log.path}`);

      void runMatrix({
        plan: request.plan,
        force: request.force,
        judgeModel: request.judgeModel,
        signal,
        askDiscard: false,
        presentation: "quiet",
        watchBuildLog: false,
        onProgress: (progress) => {
          log.append(progress.text);

          if (progress.kind === "run-start" && progress.agentPaused) {
            onBuildLog?.();
          }

          setStatus({
            kind: "matrix",
            label: progress.text,
            logPath: log.path,
            stopping: signal.aborted,
            logId: status.logId,
            matrix: progress,
            recentLines: log.recent(MATRIX_PANEL_LINES),
          });
        },
      })
        .then((result) => {
          lastMatrixResult = result;
          const label = result.stopped
            ? `stopped · ${result.finished}/${result.total} finished`
            : `done · ${result.finished}/${result.total} finished`;
          log.append(label);
          settle(label);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "matrix failed";
          log.append(`error · ${message}`);
          settle(message);
        });

      return null;
    },
    startBuild: (work: BuildWork) => {
      mkdirSync(INSPECT_LOG_DIR, { recursive: true });
      const logPath = join(INSPECT_LOG_DIR, `build-${Date.now().toString(36)}.log`);
      const signal = begin("build", "building…", logPath);

      if (!signal) {
        return busyNotice();
      }

      onBuildLog?.();
      void work({ signal, presentation: { logPath, waitForReturn: false } })
        .then((finish: BuildFinish) => {
          settle(finish.notice);
          onBuildFinish?.(finish);
        })
        .catch((error: unknown) => {
          const notice = error instanceof Error ? error.message : "build failed";
          settle(notice);
          onBuildFinish?.({ notice, failedRunIds: [] });
        });

      return null;
    },
    startCheckout: (choice: RunChoice) => {
      const signal = begin("checkout", `checking out ${choice.branch}…`, null);

      if (!signal) {
        return busyNotice();
      }

      void (async () => {
        if (signal.aborted) {
          throw new Error("checkout cancelled");
        }

        await checkOutRun({ choice, force });

        return `checked out ${choice.branch}`;
      })()
        .then((label) => {
          settle(label);
        })
        .catch((error: unknown) => {
          settle(error instanceof Error ? error.message : "checkout failed");
        });

      return null;
    },
    startClearApps: (request: ClearAppsRequest) => {
      const starting =
        request.mode === "all"
          ? "deleting every Chromium.app copy…"
          : `deleting ${request.runIds.length} Chromium.app copies…`;
      const signal = begin("clear-apps", starting, null);

      if (!signal) {
        return busyNotice();
      }

      const onProgress = (progress: Parameters<typeof clearAppProgressNotice>[0]) => {
        setStatus({
          kind: "clear-apps",
          label: clearAppProgressNotice(progress),
          logPath: null,
          stopping: signal.aborted,
          logId: null,
        });
      };

      const work =
        request.mode === "all"
          ? clearAllChromiumAppCopies({
              buildDirectory: request.buildDirectory,
              onProgress,
              signal,
            })
          : clearChromiumAppCopies({
              buildDirectory: request.buildDirectory,
              runIds: request.runIds,
              onProgress,
              signal,
            });

      void work
        .then((result) => {
          const label = signal.aborted ? `stopped · ${clearAppNotice(result)}` : clearAppNotice(result);
          settle(label);
          request.onFinish?.(label);
        })
        .catch((error: unknown) => {
          const label = error instanceof Error ? error.message : "could not delete Chromium.app copies";
          settle(label);
          request.onFinish?.(label);
        });

      return null;
    },
  };
}

function idleStatus(): ChromiumJobStatus {
  return { kind: "idle", label: "", logPath: null, stopping: false, logId: null };
}

function matrixLabel({ index, total }: { index: number; total: number }): string {
  if (total < 1) {
    return "starting matrix…";
  }

  return `running ${index}/${total}`;
}

/** Plain-language name for refuse / stop notices. */
function jobKindLabel(kind: ChromiumJobStatus["kind"]): string {
  if (kind === "clear-apps") {
    return "Chromium.app delete";
  }

  if (kind === "idle") {
    return "job";
  }

  return kind;
}
