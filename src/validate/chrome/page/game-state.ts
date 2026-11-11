import type { CdpParams, CdpSession } from "../cdp.types";
import type { PagePoint } from "../chrome-check.types";
import { describeResult, evaluate } from "./evaluate";
import { READ_GAME_STATE } from "./game-state-reader";
import type { GameRunnerUse } from "./game-state.types";

const OBJECT_GROUP = "bench-game-state";
const HARNESS_STATE = "typeof globalThis.benchGameState === 'function' ? globalThis.benchGameState() : null";
const NO_GAME =
  '"this page has no dino game state: no benchGameState and no dino Runner listening for keys in any frame"';
const READ_RUNNER = `function () { return (${READ_GAME_STATE})(this, null); }`;

/**
 * The dino game state for the run_chrome `state` action. The dino harness reports it through `benchGameState`.
 * Elsewhere (chrome://dino, a DevTools panel or its iframe) the game is a module and Runner is not a global, so
 * the Runner is found through the key listeners it registers on a document and read in place.
 */
export async function readGameState(page: CdpSession): Promise<string> {
  const harness = await evaluate({ page, code: HARNESS_STATE });

  if (harness !== "null") {
    return harness;
  }

  return withGameRunner({
    page,
    use: async (runnerId) => (runnerId == null ? NO_GAME : await callOnRunner({ page, runnerId })),
  });
}

/**
 * Finds the game's Runner in any frame of the page and passes its remote object id (or null) to `use`.
 * Only DevTools protocol queries locate it: nothing is added to the page. The ids are released afterwards.
 */
export async function withGameRunner<Result>({
  page,
  use,
}: {
  page: CdpSession;
  use: GameRunnerUse<Result>;
}): Promise<Result> {
  try {
    return await use(await findRunner(page));
  } finally {
    await page.send("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP });
  }
}

/** Reads the state of the Runner `runnerId` names. */
export async function callOnRunner({ page, runnerId }: { page: CdpSession; runnerId: string }): Promise<string> {
  const state = await page.send("Runtime.callFunctionOn", {
    objectId: runnerId,
    functionDeclaration: READ_RUNNER,
    returnByValue: true,
    objectGroup: OBJECT_GROUP,
  });

  return describeResult(state);
}

/** The middle of the Runner's canvas in page coordinates, where a user would click to focus the game. */
export async function runnerCanvasCenter({
  page,
  runnerId,
}: {
  page: CdpSession;
  runnerId: string;
}): Promise<PagePoint> {
  const canvas = await page.send("Runtime.callFunctionOn", {
    objectId: runnerId,
    functionDeclaration: "function () { return this.canvas; }",
    objectGroup: OBJECT_GROUP,
  });
  const box = await page.send("DOM.getBoxModel", { objectId: (canvas.result as CdpParams | undefined)?.objectId });
  const quad = ((box.model as CdpParams | undefined)?.content as number[] | undefined) ?? [];
  const xs = [quad[0] ?? 0, quad[2] ?? 0, quad[4] ?? 0, quad[6] ?? 0];
  const ys = [quad[1] ?? 0, quad[3] ?? 0, quad[5] ?? 0, quad[7] ?? 0];

  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

async function findRunner(page: CdpSession): Promise<string | null> {
  for (const documentId of await documentObjectIds(page)) {
    const found = await page.send("DOMDebugger.getEventListeners", { objectId: documentId });

    for (const handlerId of listenerObjectIds(found)) {
      if ((await callOnRunner({ page, runnerId: handlerId })) !== "null") {
        return handlerId;
      }
    }
  }

  return null;
}

/** Every document in the page, including iframes and shadow-hosted frames, as remote objects. */
async function documentObjectIds(page: CdpSession): Promise<string[]> {
  const tree = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const ids: string[] = [];

  for (const backendNodeId of documentNodeIds(tree.root as CdpParams)) {
    const resolved = await page.send("DOM.resolveNode", { backendNodeId, objectGroup: OBJECT_GROUP });
    const objectId = (resolved.object as CdpParams | undefined)?.objectId;

    if (typeof objectId === "string") {
      ids.push(objectId);
    }
  }

  return ids;
}

function documentNodeIds(node: CdpParams): number[] {
  const own = node.nodeName === "#document" && typeof node.backendNodeId === "number" ? [node.backendNodeId] : [];
  const children = [
    ...((node.children as CdpParams[] | undefined) ?? []),
    ...((node.shadowRoots as CdpParams[] | undefined) ?? []),
    ...(node.contentDocument ? [node.contentDocument as CdpParams] : []),
  ];

  return [...own, ...children.flatMap((child) => documentNodeIds(child))];
}

/** The listener objects, then the handler functions: Runner listens as an object with handleEvent. */
function listenerObjectIds(found: CdpParams): string[] {
  const listeners = (found.listeners as CdpParams[] | undefined) ?? [];
  const ids = listeners.flatMap((listener) =>
    [listener.originalHandler, listener.handler].map((handler) => (handler as CdpParams | undefined)?.objectId),
  );

  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}
