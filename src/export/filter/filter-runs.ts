import type { TaskRecord } from "../catalog.types";
import type { RunRecord } from "../run-records.types";
import type { ExportFilter, LatestVersions, VersionFilter } from "./export-filter.types";

/**
 * Keeps the runs the dashboard would show with these filters. `ignoreConfig` skips the Config filter, so the
 * Compare against config's runs stay available for comparisons.
 */
export function filterRuns({
  runs,
  tasks,
  filter,
  ignoreConfig = false,
}: {
  runs: RunRecord[];
  tasks: TaskRecord[];
  filter: ExportFilter;
  ignoreConfig?: boolean;
}): RunRecord[] {
  const latest: LatestVersions = new Map(
    tasks.map((task) => [task.taskId, { prompt: task.promptVersion, judgePrompt: task.judgePromptVersion }]),
  );

  return runs.filter(
    (run) =>
      isListed({ list: filter.tasks, value: run.taskId }) &&
      (ignoreConfig || isListed({ list: filter.configs, value: run.configId })) &&
      isListed({ list: filter.decisions, value: run.judge.decision ?? "unjudged" }) &&
      isListed({ list: filter.runs, value: run.runId }) &&
      matchesVersion({
        versionFilter: filter.prompt,
        taskId: run.taskId,
        version: run.promptVersion,
        latestVersion: latest.get(run.taskId)?.prompt ?? null,
      }) &&
      matchesVersion({
        versionFilter: filter.judgePrompt,
        taskId: run.taskId,
        version: run.judgePromptVersion,
        latestVersion: latest.get(run.taskId)?.judgePrompt ?? null,
      }),
  );
}

/** The filters as readable lines for the README. */
export function describeFilter(filter: ExportFilter): string[] {
  return [
    `Task: ${filter.tasks?.join(", ") ?? "All"}`,
    `Config: ${filter.configs?.join(", ") ?? "All"}`,
    `Compare against: ${filter.compareAgainst}`,
    `Prompt: ${describeVersions(filter.prompt)}`,
    `Judge prompt: ${describeVersions(filter.judgePrompt)}`,
    `Judge decision: ${filter.decisions?.join(", ") ?? "All"}`,
    `Run: ${filter.runs?.join(", ") ?? "All"}`,
  ];
}

function isListed({ list, value }: { list: string[] | null; value: string }): boolean {
  return list === null || list.includes(value);
}

function matchesVersion({
  versionFilter,
  taskId,
  version,
  latestVersion,
}: {
  versionFilter: VersionFilter;
  taskId: string;
  version: string | null;
  latestVersion: string | null;
}): boolean {
  if (versionFilter.all) {
    return true;
  }

  if (versionFilter.latest && version !== null && version === latestVersion) {
    return true;
  }

  const label = version ?? "unknown";

  return versionFilter.versions.includes(`${taskId}|${label}`) || versionFilter.versions.includes(label);
}

function describeVersions(versionFilter: VersionFilter): string {
  if (versionFilter.all) {
    return "all versions";
  }

  return [...(versionFilter.latest ? ["latest"] : []), ...versionFilter.versions].join(", ") || "none";
}
