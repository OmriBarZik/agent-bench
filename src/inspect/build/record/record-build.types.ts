/** Why a build did not pass: the compile failed, or the user cancelled it. */
export type StoppedBuildStatus = "failed" | "cancelled";

/** The notice and abort signal from a build that did not pass. */
export type BuildFailure = {
  signal: AbortSignal;
  notice: string;
};

/** Closes the chromium_builds row when the build ends. A no-op when the row was never inserted. */
export type BuildWatch = {
  passed: () => void;
  failed: (failure: BuildFailure) => void;
};
