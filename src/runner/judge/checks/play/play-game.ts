import type { CdpSession } from "../../../../validate/chrome/cdp.types";
import { clickAt } from "../../../../validate/chrome/page/click";
import { callOnRunner, runnerCanvasCenter, withGameRunner } from "../../../../validate/chrome/page/game-state";
import { pressKey } from "../../../../validate/chrome/page/press-key";
import type { PlayOutcome, PlayState } from "../bench-checks.types";

const WAIT_MS = 20_000;
const PASS_TEXT =
  "clicking its tab opened the game, a click and Space started it, the distance grew, and Space made the T-Rex jump";

/** Waits for the game in any frame, then plays it: a click on its canvas, Space to start, Space to jump. */
export async function playGame(page: CdpSession): Promise<PlayOutcome> {
  const result = await waitFor({
    find: () =>
      withGameRunner({
        page,
        use: async (runnerId) => (runnerId == null ? null : await playWithRunner({ page, runnerId })),
      }),
  });

  if (result == null) {
    return { status: "fail", reason: `its tab was clicked, but no dino game appeared within ${WAIT_MS / 1000} s.` };
  }

  return result === "played" ? { status: "pass", reason: PASS_TEXT } : { status: "fail", reason: result };
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

/** Calls `find` every half second until it returns something, or WAIT_MS passes. */
export async function waitFor<Found>({ find }: { find: () => Promise<Found | null> }): Promise<Found | null> {
  const deadline = Date.now() + WAIT_MS;

  while (Date.now() < deadline) {
    const found = await find();

    if (found != null) {
      return found;
    }

    await Bun.sleep(500);
  }

  return null;
}
