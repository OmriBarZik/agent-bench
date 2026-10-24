import { $ } from "bun";
import { cpSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ClaudeResult, Task } from "../../db/db.types";
import { BENCH_DIR, CHROMIUM_SRC, HOOK_SETTINGS, TRANSCRIPT_FILE } from "../../paths";
import type { BenchConfig } from "../bench-config/bench-config.types";

/** Output of `claude --version`, stored on every run. */
export async function claudeVersion(): Promise<string> {
  return (await $`claude --version`.cwd(BENCH_DIR).text()).trim();
}

/** The full `claude -p` command line for one task under one config. */
export function claudeArgs({
  task,
  config,
  sessionId,
}: {
  task: Task;
  config: BenchConfig;
  sessionId: string;
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
  ];

  if (config.model) {
    args.push("--model", config.model);
  }

  if (config.mcpConfig?.length) {
    args.push("--mcp-config", ...config.mcpConfig.map((path) => resolve(BENCH_DIR, path)));
  }

  if (config.strictMcpConfig) {
    args.push("--strict-mcp-config");
  }

  if (config.allowedTools?.length) {
    args.push("--allowedTools", ...config.allowedTools);
  }

  if (config.disallowedTools?.length) {
    args.push("--disallowedTools", ...config.disallowedTools);
  }

  if (config.permissionMode) {
    args.push("--permission-mode", config.permissionMode);
  }

  return args;
}

/**
 * Runs `command` in the Chromium checkout with BENCH_RUN_ID set (so the tool-log hooks record it),
 * saves stdout/stderr into `outDir`, and returns the parsed result. Never throws on a failed run:
 * a crash, timeout or unparseable output becomes a result with `is_error: true`.
 */
export async function runClaude({
  command,
  runId,
  outDir,
  timeoutMs,
}: {
  command: string[];
  runId: string;
  outDir: string;
  timeoutMs: number;
}): Promise<ClaudeResult> {
  writeFileSync(join(outDir, "command.json"), JSON.stringify(command, null, 2));

  const started = Date.now();
  const claudeProcess = Bun.spawn(command, {
    cwd: CHROMIUM_SRC,
    env: { ...process.env, BENCH_RUN_ID: runId },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: timeoutMs,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(claudeProcess.stdout).text(),
    new Response(claudeProcess.stderr).text(),
    claudeProcess.exited,
  ]);
  writeFileSync(join(outDir, "result.json"), stdout);
  writeFileSync(join(outDir, "stderr.log"), stderr);

  let result: ClaudeResult;
  try {
    result = JSON.parse(stdout);
  } catch {
    result = {
      is_error: true,
      duration_ms: Date.now() - started,
      error: claudeProcess.signalCode
        ? `killed (${claudeProcess.signalCode}), timeout?`
        : `exit ${exitCode}, unparseable output`,
      stderr: stderr.slice(-2000),
    };
  }
  if (exitCode !== 0) {
    result.is_error = true;
  }

  return result;
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
