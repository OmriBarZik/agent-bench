import { statfsSync } from "node:fs";
import { listRunDiskStates, openDb } from "../../db/db";
import type { RunDiskState } from "../../db/db.types";
import { clearChromiumAppCopies, listRemovableAppCopies } from "../build/app/clear-app";
import type { PruneAppsOptions, PruneAppsResult, PruneCandidate, PrunedCopy } from "./prune-apps.types";

/**
 * Deletes per-run Chromium.app copies whose run is done with them, oldest first.
 * A copy is done with once its run is judged or cancelled, or when the run is gone from the database.
 * A running run, or one still waiting for its judge, keeps its copy: the bench checks launch that app.
 * Never touches out/Default or out/Reports.
 */
export async function pruneAppCopies({
  buildDirectory,
  minFreeBytes,
  taskIds,
  configIds,
  dryRun = false,
  onRemove = () => {},
}: PruneAppsOptions): Promise<PruneAppsResult> {
  const db = openDb();
  const states = new Map(listRunDiskStates(db).map((state) => [state.runId, state]));
  db.close();
  const folders = listRemovableAppCopies({ buildDirectory });
  const candidates: PruneCandidate[] = [];
  const kept: string[] = [];

  for (const runId of folders) {
    const state = states.get(runId);

    if (!matchesFilter({ state, taskIds, configIds })) {
      continue;
    }

    const reason = pruneReason(state);

    if (reason === null) {
      kept.push(runId);
      continue;
    }

    candidates.push({ runId, reason, startedAt: state?.startedAt ?? "" });
  }

  candidates.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const freeBytesBefore = freeBytes(buildDirectory);
  const removed: PrunedCopy[] = [];
  let freedBytes = 0;

  for (const candidate of candidates) {
    if (minFreeBytes !== undefined && freeBytesBefore + freedBytes >= minFreeBytes) {
      break;
    }

    const removal = { runId: candidate.runId, reason: candidate.reason };

    if (!dryRun) {
      const result = await clearChromiumAppCopies({ buildDirectory, runIds: [candidate.runId] });
      freedBytes += result.freedBytes;
    }

    removed.push(removal);
    onRemove(removal);
  }

  return { removed, kept, freedBytes, freeBytesBefore, freeBytesAfter: freeBytes(buildDirectory) };
}

/** True when no filter is set, or this run's task and config are both picked. */
function matchesFilter({
  state,
  taskIds,
  configIds,
}: {
  state: RunDiskState | undefined;
  taskIds?: string[];
  configIds?: string[];
}): boolean {
  if (!taskIds && !configIds) {
    return true;
  }

  if (!state) {
    return false;
  }

  if (taskIds && !taskIds.includes(state.taskId)) {
    return false;
  }

  return !configIds || configIds.includes(state.configId);
}

/** Why this run's copy can go, or null when it must stay. */
function pruneReason(state: RunDiskState | undefined): string | null {
  if (!state) {
    return "not in the database";
  }

  if (state.status === "cancelled") {
    return "cancelled";
  }

  if (state.status !== "running" && state.judged) {
    return `judged (${state.status})`;
  }

  return null;
}

function freeBytes(path: string): number {
  const stats = statfsSync(path);

  return stats.bavail * stats.bsize;
}
