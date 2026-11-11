import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PhaseUsage } from "../../db/db.types";
import { TRANSCRIPT_FILE } from "../../paths";
import { splitPhases } from "./split-phases";

/** Splits the transcript in a run's artifact folder into phases, or returns null when it has no transcript. */
export function readRunPhases({ outDir, costUsd }: { outDir: string; costUsd: number | null }): PhaseUsage[] | null {
  const transcriptPath = join(outDir, TRANSCRIPT_FILE);

  if (!existsSync(transcriptPath)) {
    return null;
  }

  return splitPhases({ lines: readFileSync(transcriptPath, "utf8").split("\n"), costUsd });
}
