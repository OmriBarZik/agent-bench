import { join } from "node:path";
import process from "node:process";
import { BENCH_DIR } from "../paths";
import { loadSelection } from "../runner/bench-config/bench-config";
import { narrowSelection } from "../runner/bench-config/narrow-selection";
import { openStartTui } from "./open-start-tui";
import type { StartTab } from "./open-start-tui.types";
import type { PickerResult } from "./picker/picker-state.types";
import type { RunPlanFlags, StartDecision } from "./resolve-start.types";

/** --tasks when it is not passed. */
export const DEFAULT_TASKS_PATH = join(BENCH_DIR, "configs/benchmark-tasks.json");
/** --configs when it is not passed. */
export const DEFAULT_CONFIGS_PATH = join(BENCH_DIR, "configs/benchmark-setup.json");

/**
 * Decides what `bun run start` does. On a terminal with no --only-task, --only-config, or --repeats
 * (or with --interactive, --runs, or --setups), it opens the TUI: the Start tab runs a matrix and prints the equivalent
 * command, the Runs tab can check a run's branch out, the Build tab streams an agent's remote build log,
 * and the Setups tab shows which config setups are missing.
 * Otherwise the flags decide the matrix.
 */
export async function resolveStart(flags: RunPlanFlags): Promise<StartDecision> {
  const onlyTasks = idList(flags.onlyTask);
  const onlyConfigs = idList(flags.onlyConfig);
  const repeats = positiveNumber({ value: flags.repeats ?? "1", flag: "--repeats" });
  const timeoutMin = positiveNumber({ value: flags.timeoutMin, flag: "--timeout-min" });
  const terminal = process.stdin.isTTY === true && process.stdout.isTTY === true;
  const wantsTui = flags.interactive || flags.runs || flags.setups;

  if (flags.runs && flags.setups) {
    throw new Error("pass only one of --runs and --setups");
  }

  if (wantsTui && flags.cli) {
    throw new Error("--cli never opens the TUI; drop --interactive / --runs / --setups");
  }

  if (wantsTui && !terminal) {
    throw new Error(
      "--interactive, --runs, and --setups need a terminal; pass --only-task / --only-config / --repeats instead",
    );
  }

  const selectionFlagged = Boolean(onlyTasks || onlyConfigs || flags.repeats !== undefined);
  const useTui = !flags.cli && terminal && (wantsTui || !selectionFlagged);

  if (!useTui) {
    const selection = await loadSelection({ ...flags, onlyTasks, onlyConfigs });

    return {
      kind: "run",
      plan: { ...selection, repeats, timeoutMin, sync: flags.sync, autoReview: flags.autoReview },
    };
  }

  const everything = await loadSelection({ tasksPath: flags.tasksPath, configsPath: flags.configsPath });
  // Check the flagged ids against the files before the TUI opens, so a typo fails early.
  narrowSelection({ selection: everything, taskIds: onlyTasks, configIds: onlyConfigs });
  const picked = await openStartTui({
    selection: everything,
    defaults: {
      taskIds: onlyTasks,
      configIds: onlyConfigs,
      repeats,
      timeoutMin,
      sync: flags.sync,
      autoReview: flags.autoReview,
    },
    initialTab: openingTab(flags),
    force: flags.force,
  });

  if (!picked) {
    return { kind: "quit" };
  }

  if (picked.kind === "checkout") {
    return { kind: "checkout", choice: picked.choice };
  }

  console.log(`Equivalent command: ${equivalentCommand({ picked: picked.picked, flags })}`);
  const selection = narrowSelection({
    selection: everything,
    taskIds: picked.picked.taskIds,
    configIds: picked.picked.configIds,
  });

  return {
    kind: "run",
    plan: {
      ...selection,
      repeats: picked.picked.repeats,
      timeoutMin: picked.picked.timeoutMin,
      sync: picked.picked.sync,
      autoReview: picked.picked.autoReview,
    },
  };
}

/** Which tab opens. --setups and --runs each name one; otherwise the Start tab. */
function openingTab(flags: RunPlanFlags): StartTab {
  if (flags.setups) {
    return "setups";
  }

  if (flags.runs) {
    return "runs";
  }

  return "start";
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

  if (!picked.autoReview) {
    parts.push("--no-auto-review");
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
