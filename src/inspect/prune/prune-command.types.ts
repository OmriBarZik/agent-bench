/** The --prune-apps flags, as parsed from the command line. */
export type PruneCommandOptions = {
  /** --only-task values; each may hold comma-separated ids. */
  onlyTask?: string[];
  /** --only-config values; each may hold comma-separated ids. */
  onlyConfig?: string[];
  /** --min-free-gb, still a string. */
  minFreeGb?: string;
  dryRun: boolean;
};
