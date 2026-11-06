import { $ } from "bun";
import { cpSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { baselinePrompt } from "../../baseline-policy";
import type { ClaudeResult, Task } from "../../db/db.types";
import {
  BENCH_DIR,
  CHROMIUM_SRC,
  HOOK_SETTINGS,
  TRANSCRIPT_FILE,
  VALIDATE_PLUGIN_DIR,
  VALIDATE_SERVER,
} from "../../paths";
import type { BenchConfig } from "../bench-config/bench-config.types";
import { captureClaude } from "./claude-process";

/** The allowedTools pattern for the chrome-validate tools. Headless sessions cannot answer a permission prompt. */
const VALIDATE_TOOLS = "mcp__chrome-validate__*";
/** wait_build blocks up to 50 minutes; Claude Code's MCP tool timeout must outlast it. */
const MCP_TOOL_TIMEOUT_MS = String(60 * 60_000);

/** Output of `claude --version`, stored on every run. */
export async function claudeVersion(): Promise<string> {
  return (await $`claude --version`.cwd(BENCH_DIR).text()).trim();
}

/** The full `claude -p` command line for one task under one config. */
export function claudeArgs({
  task,
  config,
  sessionId,
  runId,
  autoReview = true,
}: {
  task: Task;
  config: BenchConfig;
  sessionId: string;
  /** Passed to the chrome-validate server so its builds are stored on this run. */
  runId: string;
  /** Attach chrome-validate so the agent builds its change and checks it in Chromium. */
  autoReview?: boolean;
}): string[] {
  const args = [
    "claude",
    "-p",
    task.prompt,
    "--output-format",
    "json",
    "--session-id",
    sessionId,
    "--settings",
    HOOK_SETTINGS,
    "--append-system-prompt",
    sessionPrompt({ config, autoReview }),
  ];

  if (config.model) {
    args.push("--model", config.model);
  }

  appendSessionTools({ args, task, config, runId, autoReview });

  return args;
}

/** This config's MCP servers, plus chrome-validate when auto review is on. */
function appendSessionTools({
  args,
  task,
  config,
  runId,
  autoReview,
}: {
  args: string[];
  task: Task;
  config: BenchConfig;
  runId: string;
  autoReview: boolean;
}) {
  const mcpConfigs = (config.mcpConfig ?? []).map((path) => resolve(BENCH_DIR, path));

  if (autoReview) {
    args.push("--mcp-config", validateMcpConfig({ runId, taskSha: task.chromiumSha }), ...mcpConfigs);
    args.push("--plugin-dir", VALIDATE_PLUGIN_DIR);
  } else if (mcpConfigs.length > 0) {
    args.push("--mcp-config", ...mcpConfigs);
  }

  if (config.strictMcpConfig) {
    args.push("--strict-mcp-config");
  }

  const allowed = [...(autoReview ? [VALIDATE_TOOLS] : []), ...(config.allowedTools ?? [])];

  if (allowed.length > 0) {
    args.push("--allowedTools", ...allowed);
  }

  if (config.disallowedTools?.length) {
    args.push("--disallowedTools", ...config.disallowedTools);
  }

  if (config.permissionMode) {
    args.push("--permission-mode", config.permissionMode);
  }
}

/** The chrome-validate server as an inline --mcp-config JSON, with the run it records builds on. */
export function validateMcpConfig({ runId, taskSha }: { runId: string; taskSha: string }): string {
  return JSON.stringify({
    mcpServers: {
      "chrome-validate": {
        command: "bun",
        args: [VALIDATE_SERVER],
        env: { BENCH_RUN_ID: runId, BENCH_TASK_SHA: taskSha, CHROMIUM_SRC },
      },
    },
  });
}

/** Baseline rules, then this config's note about its tools when it has one. */
function sessionPrompt({ config, autoReview }: { config: BenchConfig; autoReview: boolean }): string {
  const baseline = baselinePrompt({ autoReview });

  if (!config.toolPrompt) {
    return baseline;
  }

  return `${baseline}\n\n${config.toolPrompt}`;
}

/**
 * Runs `command` in the Chromium checkout with BENCH_RUN_ID set (so the tool-log hooks record it),
 * saves stdout/stderr into `outDir`, and returns the parsed result. Never throws on a failed run:
 * a crash, timeout, cancel, or unparseable output becomes a result with `is_error: true`.
 */
export async function runClaude({
  command,
  runId,
  outDir,
  timeoutMs,
  signal,
  autoReview,
}: {
  command: string[];
  runId: string;
  outDir: string;
  timeoutMs: number;
  /** Aborted on Ctrl+C. The process is killed and the result is marked cancelled. */
  signal?: AbortSignal;
  /** Passed through to the baseline guard so a denied local build matches this session's tools. */
  autoReview: boolean;
}): Promise<ClaudeResult> {
  writeFileSync(join(outDir, "command.json"), JSON.stringify(command, null, 2));
  const captured = await captureClaude({
    command,
    cwd: CHROMIUM_SRC,
    env: {
      ...process.env,
      BENCH_RUN_ID: runId,
      BENCH_AUTO_REVIEW: autoReview ? "1" : "0",
      MCP_TOOL_TIMEOUT: MCP_TOOL_TIMEOUT_MS,
    },
    timeoutMs,
    signal,
  });
  writeFileSync(join(outDir, "result.json"), captured.stdout);
  writeFileSync(join(outDir, "stderr.log"), captured.stderr);

  return captured.result;
}

/** Finds <sessionId>.jsonl (and its subagent dir, if any) under ~/.claude/projects and copies them into destDir. */
export function copyTranscript({
  sessionId,
  destDir,
  fileName = TRANSCRIPT_FILE,
  sessionDirName = "session",
}: {
  sessionId: string;
  destDir: string;
  /** File name inside destDir. Defaults to the agent run's transcript. */
  fileName?: string;
  /** Directory name inside destDir for subagent logs. Defaults to session. */
  sessionDirName?: string;
}): boolean {
  const projects = join(homedir(), ".claude", "projects");

  for (const projectDir of readdirSync(projects)) {
    const file = join(projects, projectDir, `${sessionId}.jsonl`);

    if (!existsSync(file)) {
      continue;
    }

    cpSync(file, join(destDir, fileName));
    const sessionDir = join(projects, projectDir, sessionId);

    if (existsSync(sessionDir)) {
      cpSync(sessionDir, join(destDir, sessionDirName), { recursive: true });
    }

    return true;
  }

  return false;
}
