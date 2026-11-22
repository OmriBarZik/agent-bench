#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { parseFilter } from "./filter/parse-filter";
import { loadExportData, writeFilteredExport } from "./run-export";

/**
 * Exports tasks, configs, and runs in a form an AI agent can read: a README that explains the benchmark and each
 * field, a per task × config summary compared against one config, tasks.json, configs.json, runs.jsonl, and
 * bench-export.md with all of it in one file to copy. Reads only; the database and runs/ are left as they are.
 *
 * The filters match the dashboard's and default to what it shows: every task, config, decision, and run, the
 * latest prompt and judge prompt, compared against baseline. Lists are comma-separated.
 *
 *   bun run export [--out dir] [--task id,id] [--config id,id] [--compare baseline]
 *                  [--prompt latest|all|<task>|<hash>|<hash>] [--judge-prompt latest|all|...]
 *                  [--decision pass,partially-pass,partially-failed,failed,unjudged] [--run run_id,run_id]
 */
function main() {
  const { values: args } = parseArgs({
    options: {
      out: { type: "string" },
      task: { type: "string" },
      config: { type: "string" },
      compare: { type: "string" },
      prompt: { type: "string" },
      "judge-prompt": { type: "string" },
      decision: { type: "string" },
      run: { type: "string" },
    },
  });
  const filter = parseFilter(args);
  const result = writeFilteredExport({ data: loadExportData(), filter, outDir: args.out });
  console.log(`exported ${result.exported} of ${result.total} runs to ${result.outDir}`);
  console.log(`one-file copy: ${result.bundlePath}`);
}

if (import.meta.main) {
  main();
}
