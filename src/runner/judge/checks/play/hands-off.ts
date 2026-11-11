import { connectCdp } from "../../../../validate/chrome/cdp";
import type { CdpSession } from "../../../../validate/chrome/cdp.types";
import { startChrome } from "../../../../validate/chrome/launch";
import { withGameRunner } from "../../../../validate/chrome/page/game-state";
import { pressKey } from "../../../../validate/chrome/page/press-key";
import type { GameWatch } from "../bench-checks.types";
import { waitFor } from "./play-game";
import { watchGame } from "./watch-game";

const GAME_URL = "chrome://dino";
const START_TIMEOUT_MS = 60_000;
/** The start jump and the intro animation are over by then, so every jump counted later is the game's own. */
const INTRO_MS = 1_500;
const AUTO_PLAY_MS = 30_000;
const RESTART_GRACE_MS = 5_000;

/**
 * Starts the built Chromium with no feature switches, opens chrome://dino, presses Space once to start the game,
 * and from then on only watches for 30 s. Returns null when the page has no dino game.
 */
export async function watchHandsOff(appPath: string): Promise<GameWatch | null> {
  const chrome = await startChrome({ appPath, switches: [], timeoutMs: START_TIMEOUT_MS });
  const page = await connectCdp(chrome.pageUrl);

  try {
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    // chrome://dino is the network-error page, so the navigation reports an error and the game still loads.
    await page.send("Page.navigate", { url: GAME_URL });

    return await waitFor({
      find: () =>
        withGameRunner({
          page,
          use: async (runnerId) => (runnerId == null ? null : await startAndWatch({ page, runnerId })),
        }),
    });
  } finally {
    page.close();
    await chrome.stop();
  }
}

async function startAndWatch({ page, runnerId }: { page: CdpSession; runnerId: string }): Promise<GameWatch> {
  await pressKey({ page, name: "Space", holdMs: 50 });
  await Bun.sleep(INTRO_MS);
  const played = await watchGame({ page, runnerId, watchMs: AUTO_PLAY_MS });

  if (!played.endedCrashed) {
    return played;
  }

  // A crash in the last moments of the watch still gets the time a restart takes.
  return watchGame({ page, runnerId, watchMs: RESTART_GRACE_MS, earlier: played });
}
