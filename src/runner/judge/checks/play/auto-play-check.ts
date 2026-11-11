import { join } from "node:path";
import type { BenchCheck, BenchCheckInput, GameWatch, PlayOutcome } from "../bench-checks.types";
import { findFinalBuild } from "../build-check";
import { watchHandsOff } from "./hands-off";

const ATTEMPTS = 2;
const NAME = "plays by itself";
/**
 * A T-Rex that gets no input crashes into the first obstacle at a distance of about 1800 (measured on the task
 * commit). A life must run more than three times that far, which is several obstacles cleared.
 */
const MIN_DISTANCE = 6_000;

/**
 * Runs the final build's full Chromium.app on chrome://dino with no feature switches: Space starts the game and
 * then nothing is sent for 30 s. The T-Rex must jump by itself, run well past where a T-Rex with no input crashes,
 * and restart after every crash. Tries twice. A Chromium error is `not-run`.
 */
export async function checkAutoPlay(input: BenchCheckInput): Promise<BenchCheck> {
  const found = await findFinalBuild(input);

  if (typeof found === "string" || found.differences.length > 0) {
    return { name: NAME, status: "not-run", detail: "The final tree has no successful build to play." };
  }

  const appPath = join(found.outputDir, "Chromium.app");
  const outcomes: PlayOutcome[] = [];

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const outcome = await tryOnce(appPath);

    if (outcome.status === "pass") {
      const retried = attempt > 1 ? ` (passed on try ${attempt})` : "";

      return { name: NAME, status: "pass", detail: `${outcome.reason}${retried}` };
    }

    outcomes.push(outcome);
  }

  const failed = outcomes.find((outcome) => outcome.status === "fail");

  if (failed != null) {
    return { name: NAME, status: "fail", detail: failed.reason };
  }

  return { name: NAME, status: "not-run", detail: outcomes.map((outcome) => outcome.reason).join("; ") };
}

/** One try. A Chromium or protocol error is `not-run`, so only the game itself can produce a fail. */
async function tryOnce(appPath: string): Promise<PlayOutcome> {
  try {
    return autoPlayOutcome(await watchHandsOff(appPath));
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);

    return { status: "not-run", reason: `Chromium could not be driven: ${message}` };
  }
}

/** Decides one try from what the bench saw after one Space and no other input. */
export function autoPlayOutcome(played: GameWatch | null): PlayOutcome {
  if (played == null) {
    return { status: "fail", reason: "chrome://dino in the built Chromium showed no dino game within 20 s." };
  }

  const on = "With no feature switches, after one Space and no other input,";
  const distances = `best distance ${Math.round(played.bestDistance)} (a T-Rex with no input crashes at about 1800)`;

  if (!played.started) {
    return { status: "fail", reason: `${on} the game did not start.` };
  }

  if (played.jumps === 0) {
    return {
      status: "fail",
      reason: `${on} the T-Rex never jumped in 30 s, so auto-play is not on in the built browser: ${distances}.`,
    };
  }

  if (played.bestDistance < MIN_DISTANCE) {
    return {
      status: "fail",
      reason: `${on} the T-Rex jumped ${played.jumps} times but did not get past the obstacles: ${distances}; it needs ${MIN_DISTANCE}.`,
    };
  }

  if (played.endedCrashed) {
    return {
      status: "fail",
      reason: `${on} the game crashed ${played.crashes} times and did not restart by itself within 5 s of the last one.`,
    };
  }

  const restarts =
    played.crashes === 0
      ? "it never crashed, so the restart was not seen"
      : `it crashed ${played.crashes} times and restarted by itself ${played.restarts} times`;

  return {
    status: "pass",
    reason: `${on} the T-Rex jumped ${played.jumps} times in 30 s, ${distances}, and ${restarts}.`,
  };
}
