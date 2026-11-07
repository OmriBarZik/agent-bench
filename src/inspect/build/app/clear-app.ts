import { existsSync, readdirSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { ClearAppProgress, ClearAppResult, ClearChromiumAppCopiesOptions } from "./clear-app.types";

/** Folders under the build directory that are never a per-run Chromium.app copy. */
const RESERVED_BUILD_FOLDERS = new Set(["Default", "Reports"]);

/**
 * Absolute folder that holds a remote (or validate) Chromium.app copy for this run.
 * Never points at out/Default — that shared app is not a per-run copy.
 */
export function runAppCopyDirectory({ buildDirectory, runId }: { buildDirectory: string; runId: string }): string {
  return join(buildDirectory, runId);
}

/** True when this Mac still has a per-run Chromium.app folder for this run id. */
export function hasChromiumAppCopy({ buildDirectory, runId }: { buildDirectory: string; runId: string }): boolean {
  return isRemovableRunFolder({ buildDirectory, folderName: runId });
}

/** Run ids under the build directory that are safe to delete (not Default or Reports). */
export function listRemovableAppCopies({ buildDirectory }: { buildDirectory: string }): string[] {
  if (!existsSync(buildDirectory)) {
    return [];
  }

  return readdirSync(buildDirectory).filter((folderName) => isRemovableRunFolder({ buildDirectory, folderName }));
}

/**
 * Deletes the per-run Chromium.app folders for these run ids, one at a time.
 * Skips missing folders and never touches Default or Reports.
 */
export async function clearChromiumAppCopies({
  buildDirectory,
  runIds,
  onProgress = () => {},
  signal,
}: ClearChromiumAppCopiesOptions): Promise<ClearAppResult> {
  const removed: string[] = [];
  const skipped: string[] = [];
  let freedBytes = 0;
  const pending = [...runIds];
  const total = runIds.length;

  for (let index = 0; index < runIds.length; index++) {
    if (signal?.aborted) {
      break;
    }

    const runId = runIds[index] ?? "";
    const folder = runAppCopyDirectory({ buildDirectory, runId });
    pending.shift();

    if (!isRemovableRunFolder({ buildDirectory, folderName: runId })) {
      skipped.push(`${runId}: no copy on disk`);
      emitProgress({
        onProgress,
        index: index + 1,
        total,
        runId,
        path: folder,
        phase: "skipped",
        removed,
        pending,
        skippedCount: skipped.length,
        freedBytes,
      });
      continue;
    }

    emitProgress({
      onProgress,
      index: index + 1,
      total,
      runId,
      path: folder,
      phase: "deleting",
      removed,
      pending,
      skippedCount: skipped.length,
      freedBytes,
    });

    const bytes = folderBytes(folder);
    await rm(folder, { recursive: true, force: true });
    freedBytes += bytes;
    removed.push(folder);

    emitProgress({
      onProgress,
      index: index + 1,
      total,
      runId,
      path: folder,
      phase: "deleted",
      removed,
      pending,
      skippedCount: skipped.length,
      freedBytes,
    });
  }

  emitProgress({
    onProgress,
    index: total,
    total,
    runId: "",
    path: "",
    phase: "done",
    removed,
    pending: [],
    skippedCount: skipped.length,
    freedBytes,
  });

  return { removed, skipped, freedBytes };
}

/**
 * Deletes every per-run Chromium.app folder under the build directory.
 * Keeps Default and Reports. Orphan folders (run gone from the DB) are removed too.
 */
export async function clearAllChromiumAppCopies({
  buildDirectory,
  onProgress,
  signal,
}: {
  buildDirectory: string;
  onProgress?: (progress: ClearAppProgress) => void;
  signal?: AbortSignal;
}): Promise<ClearAppResult> {
  if (!existsSync(buildDirectory)) {
    return { removed: [], skipped: ["build directory missing"], freedBytes: 0 };
  }

  return clearChromiumAppCopies({
    buildDirectory,
    runIds: listRemovableAppCopies({ buildDirectory }),
    onProgress,
    signal,
  });
}

function emitProgress({
  onProgress,
  index,
  total,
  runId,
  path,
  phase,
  removed,
  pending,
  skippedCount,
  freedBytes,
}: {
  onProgress: (progress: ClearAppProgress) => void;
  index: number;
  total: number;
  runId: string;
  path: string;
  phase: ClearAppProgress["phase"];
  removed: string[];
  pending: string[];
  skippedCount: number;
  freedBytes: number;
}) {
  onProgress({
    index,
    total,
    runId,
    path,
    phase,
    removed: [...removed],
    pending: [...pending],
    skippedCount,
    freedBytes,
  });
}

function isRemovableRunFolder({ buildDirectory, folderName }: { buildDirectory: string; folderName: string }): boolean {
  if (RESERVED_BUILD_FOLDERS.has(folderName) || folderName === "" || folderName === "." || folderName === "..") {
    return false;
  }

  if (folderName.includes("/") || folderName.includes("\\") || folderName.includes("..")) {
    return false;
  }

  const folder = join(buildDirectory, folderName);

  if (!existsSync(folder)) {
    return false;
  }

  try {
    return statSync(folder).isDirectory();
  } catch {
    return false;
  }
}

function folderBytes(path: string): number {
  try {
    const info = statSync(path);

    if (!info.isDirectory()) {
      return info.size;
    }

    let total = 0;

    for (const name of readdirSync(path)) {
      total += folderBytes(join(path, name));
    }

    return total;
  } catch {
    return 0;
  }
}
