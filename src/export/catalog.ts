import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listExportConfigs, listExportTasks } from "../db/export/export-queries";
import { BENCH_DIR } from "../paths";
import type { ConfigRecord, TaskRecord, TaskValidateMap } from "./catalog.types";

/** Tasks from the DB, with each task's validate mode from configs/benchmark-tasks.json. */
export function buildTaskRecords(db: Database): TaskRecord[] {
  const validateModes = readValidateModes();

  return listExportTasks(db).map((task) => ({
    taskId: task.taskId,
    title: task.title,
    difficulty: task.difficulty,
    validate: validateModes.get(task.taskId) ?? null,
    chromiumSha: task.chromiumSha,
    promptVersion: task.promptVersion,
    judgePromptVersion: task.judgePromptVersion,
    scoring: task.scoring == null ? null : JSON.parse(task.scoring),
    prompt: task.prompt,
    judgePrompt: task.judgePrompt,
  }));
}

/** Configs from the DB, with the text of each config's toolPromptFile when it is still on disk. */
export function buildConfigRecords(db: Database): ConfigRecord[] {
  return listExportConfigs(db).map((config) => {
    const tools = config.tools == null ? null : JSON.parse(config.tools);

    return {
      configId: config.configId,
      description: config.description,
      configHash: config.configHash,
      tools,
      permissions: config.permissions == null ? null : JSON.parse(config.permissions),
      toolPrompt: readToolPrompt(tools?.toolPromptFile),
    };
  });
}

function readValidateModes(): TaskValidateMap {
  const path = join(BENCH_DIR, "configs/benchmark-tasks.json");
  const modes: TaskValidateMap = new Map();

  if (!existsSync(path)) {
    return modes;
  }

  for (const task of JSON.parse(readFileSync(path, "utf8"))) {
    modes.set(task.taskId, task.validate ?? "chrome");
  }

  return modes;
}

function readToolPrompt(file: string | undefined): string | null {
  if (!file || !existsSync(join(BENCH_DIR, file))) {
    return null;
  }

  return readFileSync(join(BENCH_DIR, file), "utf8").trim();
}
