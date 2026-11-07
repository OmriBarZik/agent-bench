/** How chrome-validate builds and checks a task. Set per task in benchmark-tasks.json. */
export type ValidateMode = "chrome" | "dino" | "devtools";

/** What one validate mode builds on the build Mac and where that output lands. */
export type ValidateBuildPlan = {
  mode: ValidateMode;
  /** Ninja target passed to autoninja. */
  ninjaTarget: string;
  /**
   * Paths under the builder's `out/Default/` to copy back, relative to that directory.
   * Null means the full runnable tree (Chromium.app and its libraries), as for a chrome build.
   */
  copyPaths: string[] | null;
  /** Relative path under the copy destination that run_chrome needs (front_end, or the dino tsc tree). */
  artifactRelativePath: string | null;
};
