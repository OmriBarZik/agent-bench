import type { CdpSession } from "../../../../validate/chrome/cdp.types";
import { callOnRunner } from "../../../../validate/chrome/page/game-state";
import type { GameWatch, PlayState } from "../bench-checks.types";

const READ_EVERY_MS = 100;

/**
 * Reads the game state every 100 ms for `watchMs` and sends no input, so everything it counts the game did by
 * itself. `earlier` continues a watch that was already running.
 */
export async function watchGame({
  page,
  runnerId,
  watchMs,
  earlier = null,
}: {
  page: CdpSession;
  runnerId: string;
  watchMs: number;
  earlier?: GameWatch | null;
}): Promise<GameWatch> {
  const watch: GameWatch = earlier ?? {
    started: false,
    jumps: 0,
    crashes: 0,
    restarts: 0,
    bestDistance: 0,
    firstCrashDistance: null,
    endedCrashed: false,
  };
  const deadline = Date.now() + watchMs;
  let previous: PlayState | null = null;

  while (Date.now() < deadline) {
    const state = JSON.parse(await callOnRunner({ page, runnerId })) as PlayState;
    addRead({ watch, state, previous: previous ?? { ...state, crashed: watch.endedCrashed } });
    previous = state;

    await Bun.sleep(READ_EVERY_MS);
  }

  return watch;
}

function addRead({ watch, state, previous }: { watch: GameWatch; state: PlayState; previous: PlayState }) {
  watch.started ||= state.playing && state.distance > 0;
  watch.bestDistance = Math.max(watch.bestDistance, state.distance);
  watch.endedCrashed = state.crashed;

  if (state.crashed && !previous.crashed) {
    watch.crashes += 1;
    watch.firstCrashDistance ??= state.distance;
  }

  if (!state.crashed && previous.crashed && state.playing) {
    watch.restarts += 1;
  }

  if (state.trex?.jumping && previous.trex?.jumping === false && !state.crashed) {
    watch.jumps += 1;
  }
}
