import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigRecord, TaskRecord } from "../catalog.types";
import type { ExportFilter } from "../filter/export-filter.types";
import { describeFilter } from "../filter/filter-runs";
import type { RunRecord } from "../run-records.types";
import { summaryMarkdown } from "../summary/summary-markdown";
import type { SummaryRow } from "../summary/summary.types";
import { compactRun } from "./compact-run";
import { readmeMarkdown } from "./readme";

/**
 * Writes the export folder: README.md, summary.md/json, tasks.json, configs.json, runs.jsonl, and bench-export.md,
 * one file to paste into a chat with the guide, summary, tasks, configs, and a compact line per run. Returns its path.
 */
export function writeExport({
  outDir,
  tasks,
  configs,
  runs,
  summary,
  filter,
}: {
  outDir: string;
  tasks: TaskRecord[];
  configs: ConfigRecord[];
  runs: RunRecord[];
  summary: SummaryRow[];
  filter: ExportFilter;
}): string {
  mkdirSync(outDir, { recursive: true });
  const readme = readmeMarkdown({
    generatedAt: new Date().toISOString(),
    taskCount: tasks.length,
    configCount: configs.length,
    runCount: runs.length,
    filterLines: describeFilter(filter),
  });
  const summaryText = `# Summary by task and config\n\n${summaryMarkdown({ rows: summary, compareAgainst: filter.compareAgainst })}`;
  const runLines = runs.map((run) => JSON.stringify(run)).join("\n");

  writeFileSync(join(outDir, "README.md"), readme);
  writeFileSync(join(outDir, "summary.md"), summaryText);
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, "tasks.json"), JSON.stringify(tasks, null, 2));
  writeFileSync(join(outDir, "configs.json"), JSON.stringify(configs, null, 2));
  writeFileSync(join(outDir, "runs.jsonl"), `${runLines}\n`);

  const bundle = [
    readme,
    summaryText,
    "# Tasks (tasks.json)\n",
    fenced({ language: "json", text: JSON.stringify(tasks, null, 2) }),
    "# Configs (configs.json)\n",
    fenced({ language: "json", text: JSON.stringify(configs, null, 2) }),
    "# Runs (compact: one run per line; runs.jsonl has every field)\n",
    fenced({ language: "jsonl", text: runs.map((run) => JSON.stringify(compactRun(run))).join("\n") }),
  ].join("\n");
  const bundlePath = join(outDir, "bench-export.md");
  writeFileSync(bundlePath, bundle);

  return bundlePath;
}

/** A fence longer than any backtick run in the text, so prompts that contain code blocks stay intact. */
function fenced({ language, text }: { language: string; text: string }): string {
  const longestRun = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);

  return `${fence}${language}\n${text}\n${fence}\n`;
}
