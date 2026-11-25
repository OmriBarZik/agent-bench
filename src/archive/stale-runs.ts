import type { RunVersions } from "../db/db.types";
import type { CurrentSetup, CurrentVersions, StaleGroup, StaleRuns, StaleRunsInput } from "./stale-runs.types";

/**
 * Runs not yet archived that no longer match today's benchmark: a prompt or judge prompt that differs from the
 * task's current one, or a setup (config_hash or setup_hash) that differs from the config's current one. A run of
 * a task or config that is no longer in the input files is left alone, and so is a hash the run never recorded.
 */
export function staleRunIds({ runs, current, setups }: StaleRunsInput): StaleRuns {
  const byTask = new Map(current.map((versions) => [versions.taskId, versions]));
  const counts = new Map<string, number>();
  const runIds: string[] = [];

  for (const run of runs) {
    const versions = byTask.get(run.taskId);

    if (!versions || run.batch != null) {
      continue;
    }

    const reason = staleReason({ run, versions, setups });

    if (!reason) {
      continue;
    }

    runIds.push(run.runId);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  const groups: StaleGroup[] = [...counts].map(([label, count]) => ({ label, count }));

  return { runIds, groups };
}

/** Why a run is stale, as a log label, or null when it still matches. */
function staleReason({
  run,
  versions,
  setups,
}: {
  run: RunVersions;
  versions: CurrentVersions;
  setups: CurrentSetup[];
}): string | null {
  if (run.promptVersion !== versions.promptVersion || run.judgePromptVersion !== versions.judgePromptVersion) {
    return `${run.taskId} prompt ${run.promptVersion ?? "none"} judge ${run.judgePromptVersion ?? "none"}`;
  }

  // Runs from before the auto-review toggle always attached chrome-validate.
  const autoReview = run.autoReview !== 0;
  const setup = setups.find(
    (candidate) =>
      candidate.taskId === run.taskId && candidate.configId === run.configId && candidate.autoReview === autoReview,
  );

  if (!setup) {
    return null;
  }

  if (run.configHash != null && run.configHash !== setup.configHash) {
    return `${run.taskId} ${run.configId} config ${run.configHash.slice(0, 8)}`;
  }

  if (run.setupHash != null && run.setupHash !== setup.setupHash) {
    return `${run.taskId} ${run.configId} setup ${run.setupHash.slice(0, 8)}`;
  }

  return null;
}
