import type { RunPhase } from "../runner/run-one/run-one.types";
import type { BenchEndTitle, BuildStep, BuildTitle, RunTitle } from "./title-text.types";

/** The title while the TUI shows its tabs. */
export const IDLE_TITLE = "agent-bench";

const PHASE_LABEL: Record<RunPhase, string> = { reset: "reset", agent: "agent", judge: "judge" };

const STEP_LABEL: Record<BuildStep, string> = {
  check: "🔨 check",
  checkout: "🔨 checkout",
  send: "🔨 send",
  build: "🔨 build",
  copy: "🔨 copy",
  built: "✅ built",
  failed: "❌ build failed",
};

/** `▶ 3/12 agent · task × config r0`. Progress and step come first, because a narrow tab cuts the end. */
export function runTitle({ index, total, taskId, configId, repeat, phase }: RunTitle): string {
  return `▶ ${index}/${total} ${PHASE_LABEL[phase]} · ${taskId} × ${configId} r${repeat}`;
}

/** The title the benchmark leaves when its loop ends: every run done, or stopped after `finished` of them. */
export function benchEndTitle({ finished, total, stopped }: BenchEndTitle): string {
  if (stopped) {
    return `⏹ stopped ${finished}/${total} · agent-bench`;
  }

  return `✅ done ${finished}/${total} · agent-bench`;
}

/** `🔨 build local · task × config r0`, then `✅ built` or `❌ build failed` once it ends. */
export function buildTitle({ taskId, configId, repeat, where, step }: BuildTitle): string {
  return `${STEP_LABEL[step]} ${where} · ${taskId} × ${configId} r${repeat}`;
}
