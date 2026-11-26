#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BENCH_DIR, RUNS_DIR } from "../../src/paths";
import { bashPrograms } from "../bash/bash-programs";
import { EMPTY_STATE, stepReminder } from "./reminder-policy";
import type { ObservedCall, ReminderState } from "./reminder-policy.types";
import type { ToolPayload } from "./tool-reminder.types";

const GREP_PROGRAMS = new Set(["grep", "egrep", "fgrep"]);
const SETUP_FILE = join(BENCH_DIR, "configs/benchmark-setup.json");

/**
 * PostToolUse hook from plugins/tool-reminder, loaded only by configs that add a tool. When the agent searches with
 * grep instead of its config's tool, it adds a short reminder (configs/setup/<configId>/reminder.md) to the
 * conversation; the grep itself already ran and is never blocked. Policy in reminder-policy.ts. Logs every reminder
 * to runs/<run_id>/tool-reminders.jsonl. Like tool-log it must never break a tool: it does nothing without
 * BENCH_RUN_ID and always exits 0.
 */
async function main() {
  const runId = process.env.BENCH_RUN_ID;

  if (!runId) {
    return;
  }

  const payload = JSON.parse(await Bun.stdin.text()) as ToolPayload;
  const configId = runId.split("__")[1] ?? "";
  const setupTools = setupToolsOf(configId);
  const reminderPath = join(BENCH_DIR, "configs/setup", configId, "reminder.md");

  if (setupTools.length === 0 || !existsSync(reminderPath)) {
    return;
  }

  const statePath = join(tmpdir(), `bench-tool-reminder-${runId}.json`);
  const state: ReminderState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : EMPTY_STATE;
  const step = stepReminder({ state, call: observe({ payload, setupTools }) });
  writeFileSync(statePath, JSON.stringify(step.state));

  if (!step.remind) {
    return;
  }

  const reminder = readFileSync(reminderPath, "utf8").trim();
  logReminder({ runId, tool: payload.tool_name ?? "", count: step.state.reminders });
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: reminder } }),
  );
}

function observe({ payload, setupTools }: { payload: ToolPayload; setupTools: string[] }): ObservedCall {
  const tool = payload.tool_name ?? "";
  const programs = tool === "Bash" ? bashPrograms(payload.tool_input?.command ?? "") : [];
  const usedSetupTool = setupTools.some((setupTool) => programs.includes(setupTool) || tool.startsWith(setupTool));
  const usedGrep = tool === "Grep" || programs.some((program) => GREP_PROGRAMS.has(program));

  return { usedSetupTool, usedGrep: usedGrep && !usedSetupTool };
}

/** Appends to runs/<run_id>/tool-reminders.jsonl. A missing run folder only loses the log, never the reminder. */
function logReminder({ runId, tool, count }: { runId: string; tool: string; count: number }) {
  try {
    const line = JSON.stringify({ at: new Date().toISOString(), tool, reminder: count });
    appendFileSync(join(RUNS_DIR, runId, "tool-reminders.jsonl"), `${line}\n`);
  } catch {
    // The log is for analysis only; the reminder still has to reach the agent.
  }
}

function setupToolsOf(configId: string): string[] {
  const configs = JSON.parse(readFileSync(SETUP_FILE, "utf8")) as { configId: string; setupTools?: string[] }[];

  return configs.find((config) => config.configId === configId)?.setupTools ?? [];
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    // A reminder is a nudge. A broken one must never fail or block the agent's tool call.
  }

  process.exit(0);
}
