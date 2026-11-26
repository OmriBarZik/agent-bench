import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH_DIR } from "../../paths";

const TASKS_FILE = join(BENCH_DIR, "configs/benchmark-tasks.json");

/** Every distinct `chromiumSha` in configs/benchmark-tasks.json, in file order. */
export function readTaskShas(tasksFile: string = TASKS_FILE): string[] {
  const tasks: unknown = JSON.parse(readFileSync(tasksFile, "utf8"));

  if (!Array.isArray(tasks)) {
    throw new Error(`${tasksFile} must be an array of tasks`);
  }

  const shas: string[] = [];

  for (const task of tasks) {
    const sha: unknown = task?.chromiumSha;

    if (typeof sha === "string" && !shas.includes(sha)) {
      shas.push(sha);
    }
  }

  return shas;
}
