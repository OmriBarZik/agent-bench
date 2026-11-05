import { join } from "node:path";
import process from "node:process";
import { BENCH_DIR } from "../paths";
import { loadSelection } from "../runner/bench-config/bench-config";
import { narrowSelection } from "../runner/bench-config/narrow-selection";
import { pickMatrix } from "./picker/pick-matrix";
import type { PickerResult } from "./picker/picker-state.types";
import type { RunPlan, RunPlanFlags } from "./run-plan.types";

/** --tasks when it is not passed. */
export const DEFAULT_TASKS_PATH = join(BENCH_DIR, "configs/benchmark-tasks.json");
/** --configs when it is not passed. */
export const DEFAULT_CONFIGS_PATH = join(BENCH_DIR, "configs/benchmark-setup.json");

/**
 * Decides what `bun run start` runs. On a terminal with no --only-task, --only-config, or --repeats
 * (or with --interactive), it opens the picker and prints the equivalent command. Otherwise the flags decide.
 * Returns null when the picker is closed without starting.
 */
export async function resolveRunPlan(flags: RunPlanFlags): Promise<RunPlan | null> {
  const onlyTasks = idList(flags.onlyTask);
  const onlyConfigs = idList(flags.onlyConfig);
  const repeats = positiveNumber({ value: flags.repeats ?? "1", flag: "--repeats" });
  const timeoutMin = positiveNumber({ value: flags.timeoutMin, flag: "--timeout-min" });
  const terminal = process.stdin.isTTY === true && process.stdout.isTTY === true;

  if (flags.interactive && !terminal) {
    throw new Error("--interactive needs a terminal; pass --only-task / --only-config / --repeats instead");
  }

  const selectionFlagged = Boolean(onlyTasks || onlyConfigs || flags.repeats !== undefined);
  const usePicker = !flags.cli && terminal && (flags.interactive || !selectionFlagged);

  if (!usePicker) {
    const selection = await loadSelection({ ...flags, onlyTasks, onlyConfigs });

    return { ...selection, repeats, timeoutMin, sync: flags.sync };
  }

  const everything = await loadSelection({ tasksPath: flags.tasksPath, configsPath: flags.configsPath });
  // Check the flagged ids against the files before the picker opens, so a typo fails early.
  narrowSelection({ selection: everything, taskIds: onlyTasks, configIds: onlyConfigs });
  const picked = await pickMatrix({
    choices: {
      tasks: everything.tasks.map((task) => ({
        id: task.taskId,
        detail: [task.title, task.difficulty ? `(${task.difficulty})` : ""].filter(Boolean).join(" "),
      })),
      configs: everything.configs.map((config) => ({
        id: config.configId,
        detail: [config.model, config.description].filter(Boolean).join("  "),
      })),
    },
    defaults: { taskIds: onlyTasks, configIds: onlyConfigs, repeats, timeoutMin, sync: flags.sync },
  });

  if (!picked) {
    return null;
  }

  console.log(`Equivalent command: ${equivalentCommand({ picked, flags })}`);
  const selection = narrowSelection({ selection: everything, taskIds: picked.taskIds, configIds: picked.configIds });

  return { ...selection, repeats: picked.repeats, timeoutMin: picked.timeoutMin, sync: picked.sync };
}

/** The non-interactive command line that runs the same matrix. */
function equivalentCommand({ picked, flags }: { picked: PickerResult; flags: RunPlanFlags }): string {
  const parts = ["bun run start", "--cli"];

  if (flags.tasksPath !== DEFAULT_TASKS_PATH) {
    parts.push("--tasks", flags.tasksPath);
  }

  if (flags.configsPath !== DEFAULT_CONFIGS_PATH) {
    parts.push("--configs", flags.configsPath);
  }

  parts.push("--only-task", picked.taskIds.join(","), "--only-config", picked.configIds.join(","));
  parts.push("--repeats", String(picked.repeats), "--timeout-min", String(picked.timeoutMin));

  if (picked.sync) {
    parts.push("--sync");
  }

  return parts.join(" ");
}

/** Splits repeated, comma-separated id flags into one list; absent or empty means no filter. */
function idList(values?: string[]): string[] | undefined {
  const ids = (values ?? [])
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length ? ids : undefined;
}

function positiveNumber({ value, flag }: { value: string; flag: string }): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a whole number of at least 1, got ${value}`);
  }

  return parsed;
}
