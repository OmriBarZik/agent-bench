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
import { readValidateMode } from "./mode/validate-mode";
import type { ChromeQueue } from "./tools/chrome-queue.types";
import { TOOL_DEFINITIONS } from "./tools/tool-definitions";
import { callTool } from "./tools/tools";

/**
 * The chrome-validate MCP server (stdio). The runner starts it when auto review is on:
 *
 *   bun src/validate/main.ts      with BENCH_RUN_ID, BENCH_TASK_SHA, and BENCH_VALIDATE_MODE
 *
 * Tools: start_build snapshots the working tree and builds the task's target on the build Mac from
 * configs/builder/remote.yaml; wait_build blocks until that build ends and copies the output back;
 * run_chrome starts Chromium headless and drives a page (a dino harness, DevTools with
 * --custom-devtools-frontend, or the rebuilt Chromium.app). Every build is a `builds` row.
 * Builds still running when stdin closes are cancelled.
 */
async function main() {
  const runId = process.env.BENCH_RUN_ID || null;
  const context: ValidateContext = {
    runId,
    taskSha: process.env.BENCH_TASK_SHA ?? (await $`git rev-parse HEAD`.cwd(CHROMIUM_SRC).text()).trim(),
    chromiumSrc: CHROMIUM_SRC,
    mode: readValidateMode(),
    builder: loadBuilder(),
    logDir: runId == null ? join(tmpdir(), "chrome-validate") : join(RUNS_DIR, runId, "builds"),
  };
  const state: BuildState = { jobs: [] };
  const chromeQueue: ChromeQueue = { tail: Promise.resolve() };
  await serveStdio({
    name: "chrome-validate",
    version: "1.0.0",
    tools: TOOL_DEFINITIONS,
    callTool: (name, args) => callTool({ session: { context, state, chromeQueue }, name, args }),
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
