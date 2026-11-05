import { finishBuild, openDb, startBuild } from "../../db/db";
import type { BuildFinish, BuildStart } from "../../db/db.types";

/**
 * Inserts the builds row for a build that just started. Returns null outside a benchmark run or when the DB
 * write fails: metrics must never fail a build, so the error goes to stderr (the MCP channel is stdout).
 */
export function recordBuildStart(build: BuildStart | null): number | null {
  if (build == null) {
    return null;
  }

  try {
    const db = openDb();

    try {
      return startBuild({ db, build });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`chrome-validate: could not record build ${build.buildNumber}: ${String(error)}`);

    return null;
  }
}

/** Stores how the build ended. Does nothing when its start was not recorded. */
export function recordBuildFinish({ buildId, finish }: { buildId: number | null; finish: BuildFinish }) {
  if (buildId == null) {
    return;
  }

  try {
    const db = openDb();

    try {
      finishBuild({ db, buildId, finish });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`chrome-validate: could not record the end of build row ${buildId}: ${String(error)}`);
  }
}
