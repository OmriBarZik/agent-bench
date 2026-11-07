import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BuildFinish, BuildWork } from "../../inspect/build/build-session.types";
import { checkOutRun } from "../../inspect/checkout/checkout-run";
import type { RunChoice } from "../../inspect/list/select-state.types";
import { RUNS_DIR } from "../../paths";
import { runMatrix } from "./run-matrix";
import type {
  ChromiumJobController,
  ChromiumJobHooks,
  ChromiumJobStatus,
  StartMatrixRequest,
} from "./chromium-job.types";
import type { RunMatrixResult } from "./run-matrix.types";

const INSPECT_LOG_DIR = join(RUNS_DIR, "_inspect-builds");

/**
 * One Chromium-touching job at a time while the start TUI is open.
 * Matrix, inspect builds, and checkout share the slot; a second start is refused.
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
      return `stopping the ${status.kind}…`;
    }

    return `a ${status.kind} is already running`;
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
    });
  };

  return {
    status: () => status,
    lastMatrix: () => lastMatrixResult,
    cancel: () => {
      if (!abort || status.kind === "idle") {
        return false;
      }

      setStatus({ ...status, stopping: true, label: `stopping ${status.kind}…` });
      abort.abort();

      return true;
    },
    startMatrix: (request: StartMatrixRequest) => {
      const signal = begin("matrix", matrixLabel({ index: 0, total: 0 }), null);

      if (!signal) {
        return busyNotice();
      }

      void runMatrix({
        plan: request.plan,
        force: request.force,
        judgeModel: request.judgeModel,
        signal,
        askDiscard: false,
        presentation: "quiet",
        watchBuildLog: false,
        onProgress: (progress) => {
          if (progress.kind === "run-start" && progress.agentPaused) {
            onBuildLog?.();
          }

          setStatus({
            kind: "matrix",
            label: progress.text,
            logPath: null,
            stopping: signal.aborted,
            logId: null,
            matrix: progress,
          });
        },
      })
        .then((result) => {
          lastMatrixResult = result;
          const label = result.stopped
            ? `stopped · ${result.finished}/${result.total} finished`
            : `done · ${result.finished}/${result.total} finished`;
          settle(label);
        })
        .catch((error: unknown) => {
          settle(error instanceof Error ? error.message : "matrix failed");
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
