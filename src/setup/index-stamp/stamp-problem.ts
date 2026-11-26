import type { IndexStamp, TreeState } from "./index-stamp.types";

/**
 * Why a tree must not be indexed, or undefined when it may. An index serves exactly one commit, so the
 * tasks must share one `chromiumSha`, HEAD must be it, and `git status` must be empty.
 */
export function treeProblem({ tree, taskShas }: { tree: TreeState; taskShas: string[] }): string | undefined {
  if (taskShas.length !== 1) {
    return `the tasks use ${taskShas.length} chromiumSha values; an index serves exactly one`;
  }

  const [taskSha] = taskShas;

  if (tree.sha !== taskSha) {
    return `the checkout is at ${tree.sha}, not the task SHA ${taskSha}; git checkout --detach ${taskSha} first`;
  }

  if (tree.dirty.length > 0) {
    return `the checkout is not clean (${tree.dirty.length} status lines, first: ${tree.dirty[0]}); an index would hold those files`;
  }

  return undefined;
}

/** Why an index stamp does not match the tasks, or undefined when the index is good for them. */
export function stampProblem({ stamp, taskShas }: { stamp: IndexStamp; taskShas: string[] }): string | undefined {
  if (stamp.dirty.length > 0) {
    return `built from a dirty tree (${stamp.dirty[0]}); rebuild it`;
  }

  const otherShas = taskShas.filter((sha) => sha !== stamp.sha);

  if (otherShas.length > 0) {
    return `built at ${stamp.sha.slice(0, 12)}, tasks use ${otherShas[0]?.slice(0, 12)}; rebuild it`;
  }

  return undefined;
}

/** Parses a stamp file's text. A string comes back when it is not a stamp. */
export function parseStamp(text: string): IndexStamp | string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return "stamp is not JSON";
  }

  if (!parsed || typeof parsed !== "object") {
    return "stamp is not an object";
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.sha !== "string" || !/^[0-9a-f]{40}$/.test(record.sha)) {
    return "stamp has no sha";
  }

  if (!Array.isArray(record.dirty) || !record.dirty.every((line) => typeof line === "string")) {
    return "stamp has no dirty list";
  }

  return {
    tool: typeof record.tool === "string" ? record.tool : "",
    checkout: typeof record.checkout === "string" ? record.checkout : "",
    sha: record.sha,
    dirty: record.dirty,
    builtAt: typeof record.builtAt === "string" ? record.builtAt : "",
  };
}
