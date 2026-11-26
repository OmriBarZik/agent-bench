import type { CdpParams, CdpSession } from "../../../../validate/chrome/cdp.types";
import type { GameWatch } from "../bench-checks.types";
import { watchGame } from "./watch-game";

const RESTART_WATCH_MS = 5_000;
const GAME_OVER =
  "function () { if (typeof this.gameOver !== 'function') { return false; } this.gameOver(); return true; }";

/**
 * Ends the game through the Runner's own game-over path and watches 5 s with no input, so a restart is seen even
 * when the model never crashed by itself. Returns the watch with `forcedCrash` set, or unchanged when the game
 * was already crashed or the Runner has no game-over method to call.
 */
export async function forceCrashAndWatch({
  page,
  runnerId,
  played,
}: {
  page: CdpSession;
  runnerId: string;
  played: GameWatch;
}): Promise<GameWatch> {
  if (played.endedCrashed) {
    return played;
  }

  const called = await page.send("Runtime.callFunctionOn", {
    objectId: runnerId,
    functionDeclaration: GAME_OVER,
    returnByValue: true,
  });

  if ((called.result as CdpParams | undefined)?.value !== true) {
    return played;
  }

  const restartsBefore = played.restarts;
  const watched = await watchGame({ page, runnerId, watchMs: RESTART_WATCH_MS, earlier: { ...played } });

  return { ...watched, forcedCrash: { restarted: watched.restarts > restartsBefore } };
}
