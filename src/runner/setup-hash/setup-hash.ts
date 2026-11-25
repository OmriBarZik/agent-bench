import type { Task } from "../../db/db.types";
import { BENCH_DIR, CHROMIUM_SRC } from "../../paths";
import type { BenchConfig } from "../bench-config/bench-config.types";
import { claudeArgs } from "../claude/claude";
import type { McpConfigJson } from "./setup-hash.types";

/**
 * chrome-validate env values that change per run, per --build-timeout-min, or per --build-location, not with
 * the setup. Where the build runs does not change the tools or prompt the agent gets.
 */
const PER_RUN_ENV = ["BENCH_RUN_ID", "BENCH_TASK_SHA", "BENCH_BUILD_TIMEOUT_MS", "BENCH_BUILD_LOCATION"];

/** Arguments whose next value is the task prompt or the session, which say nothing about the setup. */
const PER_RUN_FLAGS = ["-p", "--session-id"];

/**
 * A hash of what a `claude -p` command line gives the agent besides the task prompt: the system prompt,
 * model, MCP servers, plugins, allowed tools and permission mode. Two runs with the same hash ran on the
 * same setup. It works on a stored `command.json` too, so runs from before `runs.setup_hash` can be filled.
 */
export function setupHash(command: string[]): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(JSON.stringify(normalizeCommand(command)));

  return hasher.digest("hex").slice(0, 16);
}

/** The setup hash this config would run a task with today. */
export function currentSetupHash({
  task,
  config,
  autoReview,
}: {
  task: Task;
  config: BenchConfig;
  autoReview: boolean;
}): string {
  return setupHash(claudeArgs({ task, config, sessionId: "", runId: "", autoReview }));
}

function normalizeCommand(command: string[]): string[] {
  return command.map((arg, index) => {
    if (index > 0 && PER_RUN_FLAGS.includes(command[index - 1] ?? "")) {
      return "";
    }

    return relativePaths(arg.startsWith("{") ? withoutRunEnv(arg) : arg);
  });
}

/** Drops the per-run env values from an inline --mcp-config JSON. Anything else is returned unchanged. */
function withoutRunEnv(arg: string): string {
  let parsed: McpConfigJson;

  try {
    parsed = JSON.parse(arg);
  } catch {
    // Not JSON after all, so there is nothing per-run to drop.
    return arg;
  }

  for (const server of Object.values(parsed.mcpServers ?? {})) {
    for (const name of PER_RUN_ENV) {
      delete server.env?.[name];
    }
  }

  return JSON.stringify(parsed);
}

/** Keeps the hash the same when the bench or Chromium checkout moves. */
function relativePaths(arg: string): string {
  return arg.replaceAll(BENCH_DIR, "<bench>").replaceAll(CHROMIUM_SRC, "<src>");
}
