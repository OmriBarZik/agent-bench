import { $ } from "bun";
import { join } from "node:path";
import { BENCH_DIR } from "../paths";
import type { GuardCheck } from "./guards.types";

const SSH_CONFIG = join(BENCH_DIR, "configs/builder/ssh_config");
const MIN_BATTERY = 30;
const RETRY_MS = 5 * 60_000;
const PING_MODEL = "claude-haiku-5-5";

/**
 * Waits until a run can start: the build Mac answers over SSH with at least 30% battery or on AC, and a one-line
 * haiku `claude -p` answers without the Cloudflare 403 that crashes every session for a while. Checks again every
 * five minutes, logging why it waits. Returns false when `signal` aborts.
 */
export async function waitUntilReady({ log, signal }: { log: (line: string) => void; signal: AbortSignal }) {
  while (!signal.aborted) {
    const problems = (await Promise.all([builderCheck(), claudeCheck()])).filter((check) => !check.ok);

    if (problems.length === 0) {
      return true;
    }

    log(`waiting 5 min: ${problems.map((check) => check.detail).join("; ")}`);
    await Bun.sleep(RETRY_MS);
  }

  return false;
}

async function builderCheck(): Promise<GuardCheck> {
  const result = await $`ssh -F ${SSH_CONFIG} -o ConnectTimeout=20 -o BatchMode=yes builder pmset -g batt`
    .cwd(BENCH_DIR)
    .nothrow()
    .quiet();

  if (result.exitCode !== 0) {
    return { ok: false, detail: "build Mac does not answer over SSH" };
  }

  const text = result.stdout.toString();
  const percent = Number(/(\d+)%/.exec(text)?.[1] ?? 0);

  if (percent < MIN_BATTERY && !text.includes("AC attached")) {
    return { ok: false, detail: `build Mac battery ${percent}% and not on AC` };
  }

  return { ok: true, detail: `build Mac battery ${percent}%` };
}

async function claudeCheck(): Promise<GuardCheck> {
  const result = await $`claude -p ${"Reply with the single word OK."} --model ${PING_MODEL}`
    .cwd(BENCH_DIR)
    .nothrow()
    .quiet();
  const text = `${result.stdout.toString()}${result.stderr.toString()}`;

  if (result.exitCode !== 0 || /403|Attention Required/i.test(text)) {
    return { ok: false, detail: `claude ping failed: ${text.trim().slice(0, 120)}` };
  }

  return { ok: true, detail: "claude answers" };
}
