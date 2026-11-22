import type { ExportFilter } from "../filter/export-filter.types";
import type { ExportData } from "../run-export.types";
import type { ExportForm, ExportOption, ExportSection, ListSection } from "./export-form.types";

const DECISIONS = ["pass", "partially-pass", "partially-failed", "failed", "unjudged"];
const LIST_SECTIONS = new Set<ExportSection>(["tasks", "configs", "decisions", "runs"]);

/** Section titles as the dashboard names them. */
export const SECTION_TITLES: Record<ExportSection, string> = {
  tasks: "Task",
  configs: "Config",
  compareAgainst: "Compare against",
  prompt: "Prompt",
  judgePrompt: "Judge prompt",
  decisions: "Judge decision",
  runs: "Run",
};

/** The dashboard's defaults: All everywhere, latest prompts, compared against baseline. */
export function defaultForm(): ExportForm {
  return {
    tasks: new Set(),
    configs: new Set(),
    compareAgainst: "baseline",
    prompt: new Set(["latest"]),
    judgePrompt: new Set(["latest"]),
    decisions: new Set(),
    runs: new Set(),
  };
}

/** Every row the tab lists, section by section. Options come from the runs in the DB. */
export function buildOptions(data: ExportData): ExportOption[] {
  const taskIds = unique(data.runs.map((run) => run.taskId));
  const configIds = unique(data.runs.map((run) => run.configId));
  const titles = new Map(data.tasks.map((task) => [task.taskId, task.title ?? ""]));
  const descriptions = new Map(data.configs.map((config) => [config.configId, config.description ?? ""]));
  const allRow = (section: ExportSection): ExportOption => ({ section, value: "all", label: "All", detail: "" });

  return [
    allRow("tasks"),
    ...taskIds.map((taskId) => ({
      section: "tasks" as const,
      value: taskId,
      label: taskId,
      detail: titles.get(taskId) ?? "",
    })),
    allRow("configs"),
    ...configIds.map((configId) => ({
      section: "configs" as const,
      value: configId,
      label: configId,
      detail: descriptions.get(configId) ?? "",
    })),
    ...configIds.map((configId) => ({
      section: "compareAgainst" as const,
      value: configId,
      label: configId,
      detail: "",
    })),
    ...versionOptions({ data, section: "prompt" }),
    ...versionOptions({ data, section: "judgePrompt" }),
    allRow("decisions"),
    ...DECISIONS.map((decision) => ({ section: "decisions" as const, value: decision, label: decision, detail: "" })),
    allRow("runs"),
    ...data.runs.map((run) => ({
      section: "runs" as const,
      value: run.runId,
      label: run.runId,
      detail: run.judge.decision ?? "unjudged",
    })),
  ];
}

export function isChecked({ form, option }: { form: ExportForm; option: ExportOption }): boolean {
  if (option.section === "compareAgainst") {
    return form.compareAgainst === option.value;
  }

  const picked = form[option.section];

  if (LIST_SECTIONS.has(option.section) && option.value === "all") {
    return picked.size === 0;
  }

  return picked.has(option.value);
}

/** Checks or clears one row. In a list section, All clears the picks and the last cleared pick means All again. */
export function toggleOption({ form, option }: { form: ExportForm; option: ExportOption }): ExportForm {
  if (option.section === "compareAgainst") {
    return { ...form, compareAgainst: option.value };
  }

  const picked = new Set(form[option.section]);

  if (LIST_SECTIONS.has(option.section) && option.value === "all") {
    return { ...form, [option.section as ListSection]: new Set() };
  }

  if (picked.has(option.value)) {
    picked.delete(option.value);
  } else {
    picked.add(option.value);
  }

  return { ...form, [option.section]: picked };
}

export function formToFilter(form: ExportForm): ExportFilter {
  const list = (picked: Set<string>) => (picked.size === 0 ? null : [...picked]);
  const versions = (picked: Set<string>) => ({
    latest: picked.has("latest"),
    all: picked.has("all"),
    versions: [...picked].filter((value) => value !== "latest" && value !== "all"),
  });

  return {
    tasks: list(form.tasks),
    configs: list(form.configs),
    compareAgainst: form.compareAgainst,
    prompt: versions(form.prompt),
    judgePrompt: versions(form.judgePrompt),
    decisions: list(form.decisions),
    runs: list(form.runs),
  };
}

/** latest, all versions, then every task|version the runs used, marked when it is the task's current one. */
function versionOptions({ data, section }: { data: ExportData; section: "prompt" | "judgePrompt" }): ExportOption[] {
  const current = new Map(
    data.tasks.map((task) => [task.taskId, section === "prompt" ? task.promptVersion : task.judgePromptVersion]),
  );
  const pairs = unique(
    data.runs.map(
      (run) => `${run.taskId}|${(section === "prompt" ? run.promptVersion : run.judgePromptVersion) ?? "unknown"}`,
    ),
  );

  return [
    { section, value: "latest", label: "latest", detail: "each task's current version" },
    { section, value: "all", label: "all versions", detail: "" },
    ...pairs.map((pair) => {
      const [taskId, version] = pair.split("|");

      return {
        section,
        value: pair,
        label: `${taskId} · ${version}`,
        detail: current.get(taskId!) === version ? "latest" : "",
      };
    }),
  ];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
