/** The Export tab's filter sections, in the dashboard's order. */
export type ExportSection = "tasks" | "configs" | "compareAgainst" | "prompt" | "judgePrompt" | "decisions" | "runs";

/** One checkable row on the Export tab. `value` is "all" for a section's All row. */
export type ExportOption = {
  section: ExportSection;
  value: string;
  label: string;
  detail: string;
};

/**
 * The Export tab's picks. An empty set in a list section means All. The prompt sets hold "latest", "all", or
 * `task|version` pairs, like the dashboard's Prompt and Judge prompt filters.
 */
export type ExportForm = {
  tasks: Set<string>;
  configs: Set<string>;
  compareAgainst: string;
  prompt: Set<string>;
  judgePrompt: Set<string>;
  decisions: Set<string>;
  runs: Set<string>;
};

/** The Export tab's list sections, whose empty set means All. */
export type ListSection = "tasks" | "configs" | "decisions" | "runs";
