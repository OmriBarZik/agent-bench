import { dirname, join, resolve } from "node:path";

/** Root of this repo. */
export const BENCH_DIR = resolve(dirname(import.meta.path), "..");
/** The Chromium checkout the agent works in; the runner resets it before every run. */
export const CHROMIUM_SRC = process.env.CHROMIUM_SRC ?? resolve(BENCH_DIR, "../src");
/** Hook registration passed to `claude --settings`; part of every config_hash. */
export const HOOK_SETTINGS = join(BENCH_DIR, "hooks/settings.example.json");
/** The chrome-validate MCP server. Attached when the start command's auto-review toggle is on. */
export const VALIDATE_SERVER = join(BENCH_DIR, "src/validate/main.ts");
/** Plugin passed with --plugin-dir; it carries the validate-build skill. */
export const VALIDATE_PLUGIN_DIR = join(BENCH_DIR, "plugins/chrome-validate");
/** clangd plugin. Sessions that load it get the checkout's clangd first on PATH. */
export const CLANGD_PLUGIN_DIR = join(BENCH_DIR, "plugins/clangd-lsp");
/**
 * Files that define the baseline every config shares: the settings, the Bash guard, its prompt, and the
 * chrome-validate tools and skill. Hashed into every config so a change to those rules is a new config version.
 */
export const BASELINE_HASH_FILES = [
  join(VALIDATE_PLUGIN_DIR, ".claude-plugin/plugin.json"),
  join(VALIDATE_PLUGIN_DIR, "skills/validate-build/SKILL.md"),
  join(BENCH_DIR, "src/validate/tools/tool-definitions.ts"),
  HOOK_SETTINGS,
  join(BENCH_DIR, "hooks/baseline-guard.ts"),
  join(BENCH_DIR, "hooks/bash/git-subcommand.ts"),
  join(BENCH_DIR, "hooks/bash/other-branches.ts"),
  join(BENCH_DIR, "hooks/command-policy.ts"),
  join(BENCH_DIR, "hooks/nested-scripts.ts"),
  join(BENCH_DIR, "src/baseline-policy.ts"),
];
/** Per-run artifacts: runs/<run_id>/. */
export const RUNS_DIR = join(BENCH_DIR, "runs");
/** Last Start-tab selection. Gitignored with the rest of data/. The picker restores it on the next open. */
export const START_PICKER_FILE = join(BENCH_DIR, "data/start-picker.json");
/** Build-Mac settings. Gitignored; copied from the example by setup:remote-build. */
export const REMOTE_BUILD_FILE = process.env.BENCH_REMOTE_BUILD_FILE ?? join(BENCH_DIR, "configs/builder/remote.yaml");
/** Committed template for REMOTE_BUILD_FILE. Placeholders only. */
export const REMOTE_BUILD_EXAMPLE = join(BENCH_DIR, "configs/builder/remote.yaml.example");
/** SSH fragment Include'd from ~/.ssh/config. Gitignored; written by setup:remote-build. */
export const REMOTE_SSH_CONFIG = join(BENCH_DIR, "configs/builder/ssh_config");
/** Agent session log inside a run's artifact folder. */
export const TRANSCRIPT_FILE = "transcript.jsonl";
/** Judge session log inside a run's artifact folder. */
export const JUDGE_TRANSCRIPT_FILE = "judge-transcript.jsonl";
/** Readable live log of the agent's messages and tool calls inside a run's artifact folder, written while it runs. */
export const AGENT_LIVE_LOG_FILE = "agent-live.log";
