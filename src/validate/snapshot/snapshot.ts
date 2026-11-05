import { $ } from "bun";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dirtySubmodulePaths } from "../../runner/chromium/submodules/submodules";
import type { SubmoduleCommit } from "../../inspect/gitlink/gitlink-diff.types";

const IDENTITY = { GIT_AUTHOR_NAME: "agent-bench", GIT_AUTHOR_EMAIL: "agent-bench@localhost" };

/**
 * Commits the whole working tree, untracked files included, without touching HEAD, the index, or any branch.
 * Dirty submodules get their own snapshot commit first, and the superproject snapshot points at them.
 * Returns HEAD itself when nothing differs from it.
 */
export async function snapshotTree(repo: string): Promise<string> {
  const submodulePaths = await dirtySubmodulePaths(repo);
  const snapshots = new Map<string, string>();

  for (const submodulePath of submodulePaths) {
    const overrides = childOverrides({ parent: submodulePath, snapshots });
    snapshots.set(submodulePath, await snapshotRepo({ repo: join(repo, submodulePath), overrides }));
  }

  return snapshotRepo({ repo, overrides: childOverrides({ parent: "", snapshots }) });
}

/** Snapshots already taken whose closest snapshotted parent is `parent`, as paths relative to it. */
function childOverrides({ parent, snapshots }: { parent: string; snapshots: Map<string, string> }): SubmoduleCommit[] {
  const prefix = parent === "" ? "" : `${parent}/`;
  const overrides: SubmoduleCommit[] = [];

  for (const [path, sha] of snapshots) {
    if (!path.startsWith(prefix) || path === parent) {
      continue;
    }

    const closer = [...snapshots.keys()].some(
      (other) => other !== path && other.startsWith(prefix) && other !== parent && path.startsWith(`${other}/`),
    );

    if (!closer) {
      overrides.push({ path: path.slice(prefix.length), sha });
    }
  }

  return overrides;
}

async function snapshotRepo({ repo, overrides }: { repo: string; overrides: SubmoduleCommit[] }): Promise<string> {
  const scratch = mkdtempSync(join(tmpdir(), "bench-snapshot-"));
  const index = join(scratch, "index");

  try {
    const realIndex = resolve(repo, (await $`git rev-parse --git-path index`.cwd(repo).text()).trim());

    // A copy keeps the stat cache, so `git add -A` does not rehash every file in Chromium.
    if (existsSync(realIndex)) {
      copyFileSync(realIndex, index);
    }

    const env = { ...process.env, GIT_INDEX_FILE: index };
    await $`git add -A`.cwd(repo).env(env).quiet();

    for (const override of overrides) {
      await $`git update-index --add --cacheinfo ${`160000,${override.sha},${override.path}`}`
        .cwd(repo)
        .env(env)
        .quiet();
    }

    const tree = (await $`git write-tree`.cwd(repo).env(env).text()).trim();
    const head = (await $`git rev-parse HEAD`.cwd(repo).text()).trim();
    const headTree = (await $`git rev-parse ${`${head}^{tree}`}`.cwd(repo).text()).trim();

    if (tree === headTree) {
      return head;
    }

    const commitEnv = {
      ...process.env,
      ...IDENTITY,
      GIT_COMMITTER_NAME: "agent-bench",
      GIT_COMMITTER_EMAIL: "agent-bench@localhost",
    };

    return (
      await $`git commit-tree ${tree} -p ${head} -m ${"agent-bench build snapshot"}`.cwd(repo).env(commitEnv).text()
    ).trim();
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
