import { relative } from "node:path";
import type { RoundOutcome, RoundResult } from "../../db/db.types";
import { CHROMIUM_SRC } from "../../paths";
import { VALIDATE_TOOL_PREFIX } from "../phases/validate-waits";
import { editedPath } from "./classify-call";
import type { PlacedMessage, RoundCallResult } from "./split-rounds.types";

const WAIT_BUILD = `${VALIDATE_TOOL_PREFIX}wait_build`;
const RUN_CHROME = `${VALIDATE_TOOL_PREFIX}run_chrome`;

/**
 * How one round ended, from its chrome-validate results in order: a build is failed when wait_build reports
 * anything but "ok", and a Chrome check is failed when run_chrome stops with an error. The outcome is set by the
 * last build or check of the round. Edited files are counted relative to the checkout and matched against the
 * run's final changed paths.
 */
export function roundResult({
  round,
  placed,
  results,
  finalPaths,
  isLast,
}: {
  round: number;
  placed: PlacedMessage[];
  results: Map<string, RoundCallResult>;
  finalPaths: Set<string>;
  isLast: boolean;
}): RoundResult {
  const calls = placed.filter((item) => item.round === round).flatMap((item) => item.message.calls);
  const edited = new Set(
    calls
      .map(editedPath)
      .filter((path) => path !== null)
      .map(checkoutPath),
  );
  let builds = 0;
  let failedBuilds = 0;
  let chromeRuns = 0;
  let failedChromeRuns = 0;
  let outcome: RoundOutcome = "not_validated";

  for (const call of calls) {
    const result = results.get(call.id);

    if (!result) {
      continue;
    }

    if (call.name === WAIT_BUILD) {
      const passed = !result.isError && /\) ok after /.test(result.text);
      builds += 1;
      failedBuilds += passed ? 0 : 1;
      outcome = passed ? "built" : "build_failed";
    }

    if (call.name === RUN_CHROME) {
      const passed = !result.isError && !result.text.includes("check stopped:");
      chromeRuns += 1;
      failedChromeRuns += passed ? 0 : 1;
      outcome = passed ? "checked" : "check_failed";
    }
  }

  return {
    round,
    outcome,
    builds,
    failedBuilds,
    chromeRuns,
    failedChromeRuns,
    editedFiles: edited.size,
    keptFiles: [...edited].filter((path) => finalPaths.has(path)).length,
    isLast,
  };
}

function checkoutPath(path: string): string {
  return path.startsWith("/") ? relative(CHROMIUM_SRC, path) : path;
}
