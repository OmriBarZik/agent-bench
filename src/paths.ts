/** Filesystem locations shared by the runner, the DB and the hooks. */
import { dirname, join, resolve } from "node:path";

export const BENCH_DIR = resolve(dirname(import.meta.path), "..");
export const CHROMIUM_SRC = process.env.CHROMIUM_SRC ?? resolve(BENCH_DIR, "../src");
export const HOOK_SETTINGS = join(BENCH_DIR, "hooks/settings.example.json");
export const RUNS_DIR = join(BENCH_DIR, "runs");
