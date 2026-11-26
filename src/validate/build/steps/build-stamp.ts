import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildJob, BuildStamp } from "../build-job.types";

/** Writes `bench-build.json` into `destination`. Written last, so a stamp that names a build means its output is in place. */
export function writeBuildStamp({ job, destination }: { job: BuildJob; destination: string }) {
  const stamp: BuildStamp = {
    build: job.number,
    snapshotSha: job.snapshotSha,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(join(destination, "bench-build.json"), `${JSON.stringify(stamp, null, 2)}\n`);
}
