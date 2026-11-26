import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { IndexStamp } from "./index-stamp.types";
import { parseStamp, stampProblem, treeProblem } from "./stamp-problem";
import { readTaskShas } from "./task-shas";
import { readTreeState } from "./tree-state";

/**
 * Throws unless the checkout is clean and at the one task SHA. Returns the stamp to write once the index is built.
 * Call before indexing, and call `writeIndexStamp` after.
 */
export async function requirePristineTree({ tool, checkout }: { tool: string; checkout: string }): Promise<IndexStamp> {
  const tree = await readTreeState(checkout);
  const problem = treeProblem({ tree, taskShas: readTaskShas() });

  if (problem) {
    throw new Error(`${tool}: refusing to index ${checkout}: ${problem}`);
  }

  return { tool, checkout, sha: tree.sha, dirty: tree.dirty, builtAt: "" };
}

/** Writes the stamp after the index finished. The tree is read again so a change during indexing is recorded. */
export async function writeIndexStamp({ stamp, path }: { stamp: IndexStamp; path: string }) {
  const tree = await readTreeState(stamp.checkout);
  const finished: IndexStamp = {
    ...stamp,
    dirty: tree.sha === stamp.sha ? tree.dirty : [...tree.dirty, `HEAD moved to ${tree.sha} while indexing`],
    builtAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(finished, null, 2)}\n`);
  console.log(`wrote ${path}`);

  if (finished.dirty.length > 0) {
    throw new Error(`the checkout changed while indexing; the stamp at ${path} marks the index dirty`);
  }
}

/** Why the index stamped at `path` does not serve the tasks, or undefined when it does. */
export function indexStampProblem(path: string): string | undefined {
  if (!existsSync(path)) {
    return "no index stamp; rebuild the index";
  }

  const stamp = parseStamp(readFileSync(path, "utf8"));

  if (typeof stamp === "string") {
    return stamp;
  }

  return stampProblem({ stamp, taskShas: readTaskShas() });
}
