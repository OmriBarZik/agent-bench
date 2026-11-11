import { join } from "node:path";
import { connectCdp } from "../../../validate/chrome/cdp";
import type { CdpSession } from "../../../validate/chrome/cdp.types";
import { startChrome } from "../../../validate/chrome/launch";
import { clickAt } from "../../../validate/chrome/page/click";
import { callOnRunner, runnerCanvasCenter, withGameRunner } from "../../../validate/chrome/page/game-state";
import { pressKey } from "../../../validate/chrome/page/press-key";
import { stockChromiumApp, validateBuildPlan } from "../../../validate/mode/validate-mode";
import type { BenchCheck, BenchCheckInput, PlayState, RegisteredView } from "./bench-checks.types";
import { findFinalBuild } from "./build-check";
import { isPanel, registeredViews } from "./devtools-panel";

const ATTEMPTS = 2;
const START_TIMEOUT_MS = 60_000;
const GAME_TIMEOUT_MS = 20_000;
const NAME = "play in DevTools";

/**
 * Opens the agent's panel in a stock Chromium running the final DevTools build, clicks the game, and plays it with
 * real key presses: Space must start it (distance grows) and make the T-Rex jump. Tries twice; a launch or protocol
 * failure on both tries is `not-run`, never a fail, so a flaky Chromium cannot sink a run.
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
        "No DevTools panel registration was found (a drawer view cannot be opened by URL); judge it from the code.",
    };
  }

  const plan = validateBuildPlan("devtools");
  const frontEnd = join(found.outputDir, plan.artifactRelativePath ?? "");
  const errors: string[] = [];
  let lastFail: string | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const failure = await playOnce({ input, panel, frontEnd });

      if (failure == null) {
        const retried = attempt > 1 ? ` (passed on try ${attempt})` : "";

        return { name: NAME, status: "pass", detail: `Panel '${panel.id}': ${PASS_TEXT}${retried}.` };
      }

      lastFail = failure;
    } catch (error) {
      errors.push(error instanceof Error ? error.message.split("\n")[0] : String(error));
    }
  }

  if (lastFail != null) {
    return { name: NAME, status: "fail", detail: `Panel '${panel.id}': ${lastFail}` };
  }

  return { name: NAME, status: "not-run", detail: `Chromium could not be driven: ${errors.join("; ")}` };
}

const PASS_TEXT = "the game was found, a click and Space started it, the distance grew, and Space made the T-Rex jump";

/** One try. Returns why the game failed to play, or null when it played. Throws when Chromium itself misbehaves. */
async function playOnce({
  input,
  panel,
  frontEnd,
}: {
  input: BenchCheckInput;
  panel: RegisteredView;
  frontEnd: string;
}): Promise<string | null> {
  const chrome = await startChrome({
    appPath: stockChromiumApp(input.chromiumSrc),
    switches: ["--window-size=1000,700", `--custom-devtools-frontend=file://${frontEnd}`],
    timeoutMs: START_TIMEOUT_MS,
  });
  const page = await connectCdp(chrome.pageUrl);

  try {
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Page.navigate", {
      url: `devtools://devtools/bundled/devtools_app.html?panel=${encodeURIComponent(panel.id)}`,
    });

    return await playGame(page);
  } finally {
    page.close();
    await chrome.stop();
  }
}

async function playGame(page: CdpSession): Promise<string | null> {
  const deadline = Date.now() + GAME_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await withGameRunner({
      page,
      use: async (runnerId) => (runnerId == null ? null : await playWithRunner({ page, runnerId })),
    });

    if (result != null) {
      return result === "played" ? null : result;
    }

    await Bun.sleep(500);
  }

  return `the dino game did not appear within ${GAME_TIMEOUT_MS / 1000} s of opening the panel.`;
}

async function playWithRunner({ page, runnerId }: { page: CdpSession; runnerId: string }): Promise<string> {
  const read = async () => JSON.parse(await callOnRunner({ page, runnerId })) as PlayState;
  await clickAt({ page, point: await runnerCanvasCenter({ page, runnerId }) });
  await pressKey({ page, name: "Space", holdMs: 50 });
  // Obstacles appear about 3 s after the start, so every read lands before the T-Rex can crash.
  await Bun.sleep(1_500);
  const started = await read();
  await Bun.sleep(500);
  const running = await read();
  await pressKey({ page, name: "Space", holdMs: 50 });
  await Bun.sleep(120);
  const jumped = await read();

  if (!started.playing) {
    return "a click on the game and Space did not start it (playing stayed false), so keys do not reach the game.";
  }

  if (!(running.distance > started.distance)) {
    return `the game started but did not run (distance ${started.distance} then ${running.distance}).`;
  }

  if (!(jumped.trex?.jumping || (jumped.trex?.yPos ?? 0) < (running.trex?.yPos ?? 0))) {
    return "the game runs, but Space during play did not make the T-Rex jump.";
  }

  return "played";
}
