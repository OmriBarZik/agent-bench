/** What `pruneAppCopies` should delete. */
export type PruneAppsOptions = {
  /** Folder holding one Chromium.app copy per run (`buildDirectory` in remote.yaml). */
  buildDirectory: string;
  /** Stop once this much space is free. Undefined deletes every copy that is done with. */
  minFreeBytes?: number;
  /** Only copies of these tasks. Undefined means every task. A filter skips copies whose run is not in the database. */
  taskIds?: string[];
  /** Only copies of these configs. Undefined means every config. */
  configIds?: string[];
  /** Only list what would be deleted. */
  dryRun?: boolean;
  /** Told about each folder as it is deleted (or would be, on a dry run). */
  onRemove?: (removal: PrunedCopy) => void;
};

/** One copy that was (or on a dry run would be) deleted. */
export type PrunedCopy = {
  runId: string;
  /** Why it was safe: its run is judged, cancelled, or missing from the database. */
  reason: string;
};

/** What a prune did. */
export type PruneAppsResult = {
  removed: PrunedCopy[];
  /** Copies kept because their run is still working or waiting for its judge and bench checks. */
  kept: string[];
  freedBytes: number;
  freeBytesBefore: number;
  freeBytesAfter: number;
};

/** A copy that can be deleted, with the order it goes in. */
export type PruneCandidate = {
  runId: string;
  reason: string;
  /** Orphans sort first (empty), then the oldest run. */
  startedAt: string;
};
