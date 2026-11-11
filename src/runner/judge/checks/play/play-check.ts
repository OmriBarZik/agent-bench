import { join } from "node:path";
import { connectCdp } from "../../../../validate/chrome/cdp";
import { startChrome } from "../../../../validate/chrome/launch";
import { clickAt } from "../../../../validate/chrome/page/click";
import { elementCenterById } from "../../../../validate/chrome/page/element-center";
import { stockChromiumApp, validateBuildPlan } from "../../../../validate/mode/validate-mode";
import type { BenchCheck, BenchCheckInput, PlayOutcome, RegisteredView } from "../bench-checks.types";
import { findFinalBuild } from "../build-check";
import { isPanel, registeredViews } from "./devtools-panel";
import { playGame, waitFor } from "./play-game";

const ATTEMPTS = 2;
const START_TIMEOUT_MS = 60_000;
const WINDOW_WIDTH = 1600;
const NAME = "play in DevTools";

/**
 * Opens DevTools from the final build in a stock Chromium, clicks the agent's panel tab and then the game, and plays
 * it with real key presses: Space must start it (distance grows) and make the T-Rex jump. Tries twice. Only the game
 * failing for a user is a fail; a Chromium error, or a tab the bench cannot find, is `not-run`.
 */
export async function checkPlayInDevtools(input: BenchCheckInput): Promise<BenchCheck> {
  const found = await findFinalBuild(input);

  if (typeof found === "string" || found.differences.length > 0) {
    return { name: NAME, status: "not-run", detail: "The final tree has no successful build to play." };
  }

  const panel = registeredViews(input).find((view) => isPanel(view));

  if (panel == null) {
    return {
      name: NAME,
      status: "not-run",
      detail:
        "No DevTools panel registration was found (the check opens main-panel tabs only); judge it from the code.",
    };
  }

  const plan = validateBuildPlan("devtools");
  const frontEnd = join(found.outputDir, plan.artifactRelativePath ?? "");
  const outcomes: PlayOutcome[] = [];

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const outcome = await tryOnce({ input, panel, frontEnd });

    if (outcome.status === "pass") {
      const retried = attempt > 1 ? ` (passed on try ${attempt})` : "";

      return { name: NAME, status: "pass", detail: `Panel '${panel.id}': ${outcome.reason}${retried}.` };
    }

    outcomes.push(outcome);
  }

  const failed = outcomes.find((outcome) => outcome.status === "fail");

  if (failed != null) {
    return { name: NAME, status: "fail", detail: `Panel '${panel.id}': ${failed.reason}` };
  }

  return {
    name: NAME,
    status: "not-run",
    detail: `Panel '${panel.id}': ${outcomes.map((outcome) => outcome.reason).join("; ")}`,
  };
}

/** One try. A Chromium or protocol error is `not-run`, so only the game itself can produce a fail. */
async function tryOnce({
  input,
  panel,
  frontEnd,
}: {
  input: BenchCheckInput;
  panel: RegisteredView;
  frontEnd: string;
}): Promise<PlayOutcome> {
  try {
    return await playOnce({ input, panel, frontEnd });
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);

    return { status: "not-run", reason: `Chromium could not be driven: ${message}` };
  }
}

/**
 * Opens DevTools and clicks the panel's tab, as a user would. `?panel=<id>` is no use here: Chromium only accepts
 * built-in panel ids there and turns any other into an invalid URL.
 */
async function playOnce({
  input,
  panel,
  frontEnd,
}: {
  input: BenchCheckInput;
  panel: RegisteredView;
  frontEnd: string;
}): Promise<PlayOutcome> {
  const chrome = await startChrome({
    appPath: stockChromiumApp(input.chromiumSrc),
    // Wide enough that a new panel's tab is in the tab strip, not behind the overflow menu.
    switches: [`--window-size=${WINDOW_WIDTH},700`, `--custom-devtools-frontend=file://${frontEnd}`],
    timeoutMs: START_TIMEOUT_MS,
  });
  const page = await connectCdp(chrome.pageUrl);

  try {
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Page.navigate", { url: "devtools://devtools/bundled/devtools_app.html" });
    const tab = await waitFor({ find: () => elementCenterById({ page, elementId: `tab-${panel.id}` }) });

    if (tab == null) {
      return { status: "not-run", reason: `the tab 'tab-${panel.id}' never showed in the DevTools tab strip.` };
    }

    await clickAt({ page, point: tab });

    return await playGame(page);
  } finally {
    page.close();
    await chrome.stop();
  }
}
