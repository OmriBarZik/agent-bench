import { finishChromiumBuild, openDb, startChromiumBuild } from "../../../db/db";
import type { FinishedBuildStatus } from "../../../db/db.types";
import type { RunChoice } from "../../list/select-state.types";
import type { BuildTarget } from "../build-session.types";
import type { BuildFailure, BuildWatch, StoppedBuildStatus } from "./record-build.types";

/**
 * Starts a chromium_builds row for this run.
 * The watch closes it when chrome exits. A database error is logged and does not stop the build.
 */
export function openBuildWatch({
  choice,
  target,
  host,
}: {
  choice: RunChoice;
  target: BuildTarget;
  host: string;
}): BuildWatch {
  const startedMs = Date.now();
  const id = insertBuild({ runId: choice.runId, target, host });

  return {
    passed() {
      closeBuild({ id, startedMs, status: "passed", error: null });
    },
    failed(failure) {
      closeBuild({ id, startedMs, status: buildStatus(failure), error: failure.notice });
    },
  };
}

/** Cancelled when the user stopped it. Anything else that did not pass is a failure. */
export function buildStatus({ signal, notice }: BuildFailure): StoppedBuildStatus {
  if (signal.aborted || notice === "build cancelled") {
    return "cancelled";
  }

  return "failed";
}

function insertBuild({ runId, target, host }: { runId: string; target: BuildTarget; host: string }): number | null {
  try {
    const db = openDb();

    try {
      return startChromiumBuild({ db, build: { runId, target, host } });
    } finally {
      db.close();
    }
  } catch (error) {
    // The compile is the work. A results-database problem must not cancel it.
    console.error(error instanceof Error ? error.message : "could not record the build");

    return null;
  }
}

function closeBuild({
  id,
  startedMs,
  status,
  error,
}: {
  id: number | null;
  startedMs: number;
  status: FinishedBuildStatus;
  error: string | null;
}) {
  if (id == null) {
    return;
  }

  try {
    const db = openDb();

    try {
      finishChromiumBuild({ db, build: { id, status, durationMs: Date.now() - startedMs, error } });
    } finally {
      db.close();
    }
  } catch (closeError) {
    // Same as insert: losing the row is better than failing a build that already ran.
    console.error(closeError instanceof Error ? closeError.message : "could not record the build");
  }
}
