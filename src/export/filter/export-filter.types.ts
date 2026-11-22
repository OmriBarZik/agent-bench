/** Which prompt versions to keep, like the dashboard's Prompt filter: latest, all versions, or picked versions. */
export type VersionFilter = {
  latest: boolean;
  all: boolean;
  /** `task|version` pairs, or bare version hashes that match on any task. */
  versions: string[];
};

/** The dashboard filters, applied to the export. A null list means All. */
export type ExportFilter = {
  tasks: string[] | null;
  configs: string[] | null;
  compareAgainst: string;
  prompt: VersionFilter;
  judgePrompt: VersionFilter;
  decisions: string[] | null;
  runs: string[] | null;
};

/** The export's filter flags as parseArgs returns them. */
export type FilterArgs = {
  task?: string;
  config?: string;
  compare?: string;
  prompt?: string;
  "judge-prompt"?: string;
  decision?: string;
  run?: string;
};

/** The current prompt and judge prompt version of each task, which `latest` matches. */
export type LatestVersions = Map<string, TaskVersions>;

/** One task's current prompt versions. */
export type TaskVersions = {
  prompt: string | null;
  judgePrompt: string | null;
};
