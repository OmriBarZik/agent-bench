import type { ChromiumBuildTarget } from "../../../db/db.types";

/** What chromiumAppPath needs to decide which Chromium.app belongs to a run. */
export type ChromiumAppPathInput = {
  runId: string;
  chromiumSrc: string;
  /** Directory a build-Mac build copies Chromium.app into, one subdirectory per run. */
  buildDirectory: string;
  /** Newest passed build for this run, or null when none passed. */
  latestTarget: ChromiumBuildTarget | null;
  /** Run whose passed local build is the newest. The shared out/Default app is that run's chrome. */
  latestLocalRunId: string | null;
  remoteAppExists: boolean;
  localAppExists: boolean;
};
