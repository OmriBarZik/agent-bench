import { idList } from "../../start/resolve-start";
import { chromiumBuildDirectory } from "../build/app/chromium-app";
import { pruneAppCopies } from "./prune-apps";
import type { PruneCommandOptions } from "./prune-command.types";

const GIGABYTE = 1024 ** 3;

/**
 * `bun run start --prune-apps [--only-task id,id] [--only-config id,id] [--min-free-gb n] [--dry-run]`: deletes
 * finished runs' Chromium.app copies, only for those tasks and configs when given, and prints what it did.
 * With --min-free-gb it stops as soon as that much disk is free, so it is safe to call between runs.
 */
export async function runPruneCommand({ onlyTask, onlyConfig, minFreeGb, dryRun }: PruneCommandOptions) {
  const minFree = minFreeGb === undefined ? undefined : Number(minFreeGb);

  if (minFree !== undefined && !(minFree >= 0)) {
    throw new Error(`--min-free-gb must be a number of GB, got "${minFreeGb}"`);
  }

  const buildDirectory = chromiumBuildDirectory();
  const verb = dryRun ? "would delete" : "deleted";
  const result = await pruneAppCopies({
    buildDirectory,
    minFreeBytes: minFree === undefined ? undefined : minFree * GIGABYTE,
    taskIds: idList(onlyTask),
    configIds: idList(onlyConfig),
    dryRun,
    onRemove: (removal) => {
      console.log(`  ${verb} ${removal.runId} (${removal.reason})`);
    },
  });

  for (const runId of result.kept) {
    console.log(`  kept ${runId} (run still needs it)`);
  }

  const before = (result.freeBytesBefore / GIGABYTE).toFixed(1);
  const after = (result.freeBytesAfter / GIGABYTE).toFixed(1);
  const freed = (result.freedBytes / GIGABYTE).toFixed(1);

  if (dryRun) {
    console.log(
      `${buildDirectory}: ${result.removed.length} ${verb}, ${before} GB free now (dry run, sizes not measured)`,
    );

    return;
  }

  console.log(`${buildDirectory}: ${result.removed.length} ${verb}, ${freed} GB freed, ${before} → ${after} GB free`);
}
