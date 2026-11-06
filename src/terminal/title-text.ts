import type { RunPhase } from "../runner/run-one/run-one.types";
import type { BenchEndTitle, BuildStep, BuildTitle, RunTitle } from "./title-text.types";

/** `agent-bench · Runs`: the title while the TUI shows the tab labelled `label`. */
export function tabTitle(label: string): string {
  return `agent-bench · ${label}`;
}

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

/** `m:ss`, or `h:mm:ss` once an hour has passed. */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

/**
 * `▶ 0:07 · 3/12 agent · task × config r0`. The clock comes first, because a narrow tab cuts the end.
 * It is the time since the agent was given the task, and it is omitted while the tree is still being checked out.
 */
export function runTitle({ index, total, taskId, configId, repeat, phase, elapsedMs }: RunTitle): string {
  const clock = elapsedMs == null ? "" : `${formatElapsed(elapsedMs)} · `;

  return `▶ ${clock}${index}/${total} ${PHASE_LABEL[phase]} · ${taskId} × ${configId} r${repeat}`;
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
