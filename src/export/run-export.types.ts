import type { ConfigRecord, TaskRecord } from "./catalog.types";
import type { RunRecord } from "./run-records.types";

/** Every task, config, and run read from the DB once; filters apply to it without reading again. */
export type ExportData = {
  tasks: TaskRecord[];
  configs: ConfigRecord[];
  runs: RunRecord[];
};

/** What one export wrote. */
export type ExportResult = {
  outDir: string;
  bundlePath: string;
  exported: number;
  total: number;
};
