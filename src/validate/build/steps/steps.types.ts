import type { BuildStep } from "../../../db/db.types";
import type { ValidateBuildPlan } from "../../mode/validate-mode.types";
import type { BuildJob, StepTimes, ValidateContext } from "../build-job.types";

/** Where chrome-validate builds the agent's change. Set by `BENCH_BUILD_LOCATION`; `remote` is the default. */
export type BuildLocation = "remote" | "local";

/** The step a build is on, updated as it moves so a failure names the step that threw. */
export type StepProgress = {
  step: BuildStep;
};

/** Everything one run of the build steps needs, on this Mac or the build Mac. */
export type StepRun = {
  job: BuildJob;
  context: ValidateContext;
  plan: ValidateBuildPlan;
  /** Folder on this Mac that receives this run's build output. */
  destination: string;
  logPath: string;
  times: StepTimes;
  progress: StepProgress;
};
