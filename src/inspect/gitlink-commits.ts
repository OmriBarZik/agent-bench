import { $ } from "bun";
import { join } from "node:path";
import { parseGitlinkDiff } from "./gitlink-diff";
import type { SubmoduleCommit } from "./gitlink-diff.types";

/**
 * Submodule commits reachable from `tip` but not from `base`, deepest first.
 * Removed gitlinks are omitted. The builder already has commits that are in `base`.
 */
export async function gitlinkCommitsBetween({
  repo,
  base,
  tip,
}: {
  repo: string;
  base: string;
  tip: string;
}): Promise<SubmoduleCommit[]> {
  return collect({ repo, base, tip, prefix: "" });
}

async function collect({
  repo,
  base,
  tip,
  prefix,
}: {
  repo: string;
  base: string;
  tip: string;
  prefix: string;
}): Promise<SubmoduleCommit[]> {
  let raw: string;

  try {
    raw = await $`git -c core.abbrev=40 diff --raw -z ${base} ${tip}`.cwd(repo).text();
  } catch (error) {
    const message = error instanceof Error ? error.message : "git diff failed";

    throw new Error(`could not compare ${base} and ${tip} in ${repo}: ${message}`);
  }

  const commits: SubmoduleCommit[] = [];

  for (const change of parseGitlinkDiff(raw)) {
    const path = prefix === "" ? change.path : `${prefix}/${change.path}`;

    if (change.previousSha && change.sha) {
      const nested = await collect({
        repo: join(repo, change.path),
        base: change.previousSha,
        tip: change.sha,
        prefix: path,
      });
      commits.push(...nested);
    }

    if (change.sha) {
      commits.push({ path, sha: change.sha });
    }
  }

  return commits;
}
