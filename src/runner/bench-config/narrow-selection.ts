import type { Selection } from "./bench-config.types";

/**
 * Keeps only the listed task and config ids, in file order. An absent list keeps every entry.
 * Throws when an id is not in the file, or when nothing is left.
 */
export function narrowSelection({
  selection,
  taskIds,
  configIds,
}: {
  selection: Selection;
  taskIds?: string[];
  configIds?: string[];
}): Selection {
  rejectUnknown({ label: "task", wanted: taskIds, known: selection.tasks.map((task) => task.taskId) });
  rejectUnknown({ label: "config", wanted: configIds, known: selection.configs.map((config) => config.configId) });
  const tasks = selection.tasks.filter((task) => !taskIds || taskIds.includes(task.taskId));
  const configs = selection.configs.filter((config) => !configIds || configIds.includes(config.configId));

  if (!tasks.length || !configs.length) {
    throw new Error("no tasks/configs selected");
  }

  return { tasks, configs };
}

function rejectUnknown({ label, wanted, known }: { label: string; wanted?: string[]; known: string[] }): void {
  const unknown = (wanted ?? []).filter((id) => !known.includes(id));

  if (unknown.length) {
    throw new Error(`unknown ${label} ${unknown.join(", ")}; known: ${known.join(", ")}`);
  }
}
