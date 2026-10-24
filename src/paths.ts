import { dirname, join, resolve } from "node:path";

/** Root of this repo. */
export const BENCH_DIR = resolve(dirname(import.meta.path), "..");
/** The Chromium checkout the agent works in; the runner resets it before every run. */
export const CHROMIUM_SRC = process.env.CHROMIUM_SRC ?? resolve(BENCH_DIR, "../src");
/** Hook registration passed to `claude --settings`; part of every config_hash. */
export const HOOK_SETTINGS = join(BENCH_DIR, "hooks/settings.example.json");
/** Per-run artifacts: runs/<run_id>/. */
export const RUNS_DIR = join(BENCH_DIR, "runs");
/** Agent session log inside a run's artifact folder. */
export const TRANSCRIPT_FILE = "transcript.jsonl";
/** Judge session log inside a run's artifact folder. */
export const JUDGE_TRANSCRIPT_FILE = "judge-transcript.jsonl";
