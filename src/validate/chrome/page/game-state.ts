import type { CdpParams, CdpSession } from "../cdp.types";
import { describeResult, evaluate } from "./evaluate";
import { READ_GAME_STATE } from "./game-state-reader";

const OBJECT_GROUP = "bench-game-state";
const HARNESS_STATE = "typeof globalThis.benchGameState === 'function' ? globalThis.benchGameState() : null";
const LISTENER_TARGETS = ["document", "window"];
const NO_GAME =
  '"this page has no dino game state: no benchGameState and no dino Runner listening for keys on the page"';

/**
 * The dino game state for the run_chrome `state` action. The dino harness reports it through `benchGameState`.
 * On chrome://dino the game is a module and Runner is not a global, so the Runner is found through the key
 * listeners it registers on the document (DOMDebugger.getEventListeners) and read in place, without changing the page.
 */
export async function readGameState(page: CdpSession): Promise<string> {
  const harness = await evaluate({ page, code: HARNESS_STATE });

  if (harness !== "null") {
    return harness;
  }

  try {
    return (await readRunnerFromListeners(page)) ?? NO_GAME;
  } finally {
    await page.send("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP });
  }
}

async function readRunnerFromListeners(page: CdpSession): Promise<string | null> {
  for (const target of LISTENER_TARGETS) {
    const evaluated = await page.send("Runtime.evaluate", { expression: target, objectGroup: OBJECT_GROUP });
    const targetId = (evaluated.result as CdpParams | undefined)?.objectId;

    if (typeof targetId !== "string") {
      continue;
    }

    const found = await page.send("DOMDebugger.getEventListeners", { objectId: targetId });

    for (const handlerId of listenerObjectIds(found)) {
      const state = await page.send("Runtime.callFunctionOn", {
        objectId: handlerId,
        functionDeclaration: `function () { return (${READ_GAME_STATE})(this, null); }`,
        returnByValue: true,
        objectGroup: OBJECT_GROUP,
      });
      const described = describeResult(state);

      if (described !== "null") {
        return described;
      }
    }
  }

  return null;
}

/** The listener objects, then the handler functions: Runner listens as an object with handleEvent. */
function listenerObjectIds(found: CdpParams): string[] {
  const listeners = (found.listeners as CdpParams[] | undefined) ?? [];
  const ids = listeners.flatMap((listener) =>
    [listener.originalHandler, listener.handler].map((handler) => (handler as CdpParams | undefined)?.objectId),
  );

  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}
