import { join } from "node:path";
import { openDb } from "../db/db";
import { BENCH_DIR, RUNS_DIR } from "../paths";
import { buildConfigRecords, buildTaskRecords } from "./catalog";
import type { ExportFilter } from "./filter/export-filter.types";
import { filterRuns } from "./filter/filter-runs";
import { buildRunRecords } from "./run-records";
import type { ExportData, ExportResult } from "./run-export.types";
import { addComparisons } from "./summary/compare";
import { summarizeRuns } from "./summary/summary";
import { writeExport } from "./write/write-export";

/** Reads every task, config, and run from the results DB and runs/. Reads only. */
export function loadExportData(dbPath?: string): ExportData {
  const db = openDb(dbPath);
  const data = {
    tasks: buildTaskRecords(db),
    configs: buildConfigRecords(db),
    runs: buildRunRecords({ db, runsDir: RUNS_DIR }),
  };
  db.close();

  return data;
}

/** A new folder under exports/, named after the current time. */
export function defaultExportDir(): string {
  return join(BENCH_DIR, "exports", new Date().toISOString().replace(/[:.]/g, "-"));
}

/**
 * Writes the runs that match the filter, with only their tasks and configs (plus the Compare against config).
 * The summary compares against that config's runs with every filter but Config applied, like the dashboard.
 */
export function writeFilteredExport({
  data,
  filter,
  outDir = defaultExportDir(),
}: {
  data: ExportData;
  filter: ExportFilter;
  outDir?: string;
}): ExportResult {
  const runs = filterRuns({ runs: data.runs, tasks: data.tasks, filter });
  const againstRuns = filterRuns({ runs: data.runs, tasks: data.tasks, filter, ignoreConfig: true });
  const summary = addComparisons({
    rows: summarizeRuns(runs),
    againstRows: summarizeRuns(againstRuns),
    compareAgainst: filter.compareAgainst,
  });
  const taskIds = new Set(runs.map((run) => run.taskId));
  const configIds = new Set([...runs.map((run) => run.configId), filter.compareAgainst]);
  const bundlePath = writeExport({
    outDir,
    tasks: data.tasks.filter((task) => taskIds.has(task.taskId)),
    configs: data.configs.filter((config) => configIds.has(config.configId)),
    runs,
    summary,
    filter,
  });

  return { outDir, bundlePath, exported: runs.length, total: data.runs.length };
}
