import { $ } from "bun";
import { join } from "node:path";
import { commitStaged } from "../git-commit";
import type { SubmoduleCheckout } from "./submodules.types";

// `git submodule foreach` runs this with `$displaypath` set. A tab separates the flag from the path.
const LIST_SCRIPT = `set -eu
if [ -n "$(git status --porcelain)" ]; then
  printf '1\\t%s\\n' "$displaypath"
else
  printf '0\\t%s\\n' "$displaypath"
fi`;

// `-x` would wipe ignored build output. A second `-f` would delete nested git dirs that are not submodules.
const DISCARD_SCRIPT = `set -eu
git reset --hard --quiet
git clean -fdq`;

/**
 * Throws away tracked edits and untracked files in every checked-out submodule.
 * `git reset --recurse-submodules` does not reach them: gclient never runs `git submodule init`.
 */
export async function discardSubmoduleChanges(repo: string) {
  await forEachSubmodule({ repo, script: DISCARD_SCRIPT });
}

/**
 * Points every checked-out submodule at the commit its gitlink has at HEAD.
 * A submodule already on that commit is left as it is, including any uncommitted edits.
 */
export async function syncSubmodulesToHead({ repo, force }: { repo: string; force: boolean }) {
  await forEachSubmodule({ repo, script: syncScript(force) });
}

/**
 * Commits dirty submodule checkouts, deepest first, so a parent gitlink includes the nested commit.
 * A checkout whose index already matches HEAD is left uncommitted.
 */
export async function commitDirtySubmodules({ repo, message }: { repo: string; message: string }) {
  const paths = submodulesToCommit(await listSubmodules(repo));

  for (const submodulePath of paths) {
    const directory = join(repo, submodulePath);
    await $`git add -A`.cwd(directory).quiet();
    await commitStaged({ repo: directory, message });
  }
}

function syncScript(force: boolean): string {
  const checkout = force ? `git checkout --quiet --force --detach "$sha"` : `git checkout --quiet --detach "$sha"`;

  // HEAD:path is already the gitlink commit. Peeling with ^{commit} looks up a path that does not exist.

  return `set -eu
sha=$(git -C "$toplevel" rev-parse -q --verify "HEAD:$sm_path" 2>/dev/null || true)
if [ -z "$sha" ]; then
  exit 0
fi
current=$(git rev-parse -q --verify HEAD)
if [ "$current" = "$sha" ]; then
  exit 0
fi
${checkout}
git clean -fdq`;
}

async function listSubmodules(repo: string): Promise<SubmoduleCheckout[]> {
  const output = await $`git submodule foreach --recursive --quiet ${LIST_SCRIPT}`.cwd(repo).text();

  return parseSubmoduleList(output);
}

async function forEachSubmodule({ repo, script }: { repo: string; script: string }) {
  await $`git submodule foreach --recursive --quiet ${script}`.cwd(repo).quiet();
}

function parseSubmoduleList(raw: string): SubmoduleCheckout[] {
  const checkouts: SubmoduleCheckout[] = [];

  for (const line of raw.split("\n")) {
    if (line === "") {
      continue;
    }

    const tab = line.indexOf("\t");

    if (tab === -1) {
      continue;
    }

    checkouts.push({ dirty: line.slice(0, tab) === "1", path: line.slice(tab + 1) });
  }

  return checkouts;
}

/** Dirty checkouts plus any submodule that contains one, deepest path first. */
function submodulesToCommit(checkouts: SubmoduleCheckout[]): string[] {
  const known = new Set(checkouts.map((checkout) => checkout.path));
  const needed = new Set<string>();

  for (const checkout of checkouts) {
    if (!checkout.dirty) {
      continue;
    }

    needed.add(checkout.path);
    const parts = checkout.path.split("/");

    for (let index = 1; index < parts.length; index++) {
      const ancestor = parts.slice(0, index).join("/");

      if (known.has(ancestor)) {
        needed.add(ancestor);
      }
    }
  }

  return [...needed].sort(
    (left, right) => right.split("/").length - left.split("/").length || left.localeCompare(right),
  );
}
