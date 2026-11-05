#!/usr/bin/env bun
import { $ } from "bun";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builderConfig } from "../inspect/build/builder-config";
import type { BuilderConfig } from "../inspect/build/builder-config.types";
import { CHROMIUM_SRC, RUNS_DIR } from "../paths";
import { cancelBuildJobs } from "./build/build-job";
import type { BuildState, ValidateContext } from "./build/build-job.types";
import { serveStdio } from "./mcp/protocol";
import { TOOL_DEFINITIONS } from "./tools/tool-definitions";
import { callTool } from "./tools/tools";

/**
 * The chrome-validate MCP server (stdio). The runner starts it for every agent session:
 *
 *   bun src/validate/main.ts      with BENCH_RUN_ID and BENCH_TASK_SHA in the environment
 *
 * Tools: start_build snapshots the working tree and builds chrome on the build Mac from
 * configs/builder/remote.yaml; wait_build blocks until that build ends and copies Chromium.app back;
 * run_chrome starts the newest good build headless and drives a page. Every build is a `builds` row.
 * Builds still running when stdin closes are cancelled.
 */
async function main() {
  const runId = process.env.BENCH_RUN_ID || null;
  const context: ValidateContext = {
    runId,
    taskSha: process.env.BENCH_TASK_SHA ?? (await $`git rev-parse HEAD`.cwd(CHROMIUM_SRC).text()).trim(),
    chromiumSrc: CHROMIUM_SRC,
    builder: loadBuilder(),
    logDir: runId == null ? join(tmpdir(), "chrome-validate") : join(RUNS_DIR, runId, "builds"),
  };
  const state: BuildState = { jobs: [] };
  await serveStdio({
    name: "chrome-validate",
    version: "1.0.0",
    tools: TOOL_DEFINITIONS,
    callTool: (name, args) => callTool({ session: { context, state }, name, args }),
  });
  cancelBuildJobs(state);
  await Promise.all(state.jobs.map((job) => job.done));
}

/** A broken remote.yaml must not stop the server; start_build reports that builds are unavailable. */
function loadBuilder(): BuilderConfig | null {
  try {
    return builderConfig();
  } catch (error) {
    console.error(`chrome-validate: ${String(error)}`);

    return null;
  }
}

if (import.meta.main) {
  await main();
}
