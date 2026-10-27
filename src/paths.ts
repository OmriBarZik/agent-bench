import { dirname, join, resolve } from "node:path";

/** Root of this repo. */
export const BENCH_DIR = resolve(dirname(import.meta.path), "..");
/** The Chromium checkout the agent works in; the runner resets it before every run. */
export const CHROMIUM_SRC = process.env.CHROMIUM_SRC ?? resolve(BENCH_DIR, "../src");
/** Hook registration passed to `claude --settings`; part of every config_hash. */
export const HOOK_SETTINGS = join(BENCH_DIR, "hooks/settings.example.json");
/**
 * Files that define the baseline every config shares: the settings, the Bash guard, and its prompt.
 * Hashed into every config so a change to those rules is a new config version.
 */
export const BASELINE_HASH_FILES = [
  HOOK_SETTINGS,
  join(BENCH_DIR, "hooks/baseline-guard.ts"),
  join(BENCH_DIR, "hooks/command-policy.ts"),
  join(BENCH_DIR, "hooks/nested-scripts.ts"),
  join(BENCH_DIR, "src/baseline-policy.ts"),
];
/** Per-run artifacts: runs/<run_id>/. */
export const RUNS_DIR = join(BENCH_DIR, "runs");
/** Build-Mac settings. Gitignored; copied from the example by setup:remote-build. */
export const REMOTE_BUILD_FILE = join(BENCH_DIR, "configs/builder/remote.yaml");
/** Committed template for REMOTE_BUILD_FILE. Placeholders only. */
export const REMOTE_BUILD_EXAMPLE = join(BENCH_DIR, "configs/builder/remote.yaml.example");
/** SSH fragment Include'd from ~/.ssh/config. Gitignored; written by setup:remote-build. */
export const REMOTE_SSH_CONFIG = join(BENCH_DIR, "configs/builder/ssh_config");
/** Agent session log inside a run's artifact folder. */
export const TRANSCRIPT_FILE = "transcript.jsonl";
/** Judge session log inside a run's artifact folder. */
export const JUDGE_TRANSCRIPT_FILE = "judge-transcript.jsonl";
