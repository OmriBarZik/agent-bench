import { RSYNC_SSH, sshCommand } from "../../builder/ssh";
import type { SubmoduleCommit } from "../gitlink/gitlink-diff.types";

/** `git submodule foreach` body. Checks out the gitlink at HEAD and does not touch ignored build output. */
const SYNC_SUBMODULES = `git submodule foreach --recursive --quiet 'sha=$(git -C "$toplevel" rev-parse -q --verify "HEAD:$sm_path" 2>/dev/null || true)
if [ -z "$sha" ]; then
  exit 0
fi
current=$(git rev-parse -q --verify HEAD)
if [ "$current" = "$sha" ]; then
  exit 0
fi
git checkout --quiet --force --detach "$sha"
git clean -fdq'`;

/** Shell that checks out the branch on the builder and builds chrome. Args are source, branch, depot_tools. */
export function remoteBuildScript({ argsGn, commits }: { argsGn: string; commits: SubmoduleCommit[] }): string {
  if (argsGn.includes("END_ARGS")) {
    throw new Error("configs/builder/args.gn cannot contain END_ARGS");
  }

  const checkouts = commits.map((commit) => checkoutLine(commit)).join("\n");

  return `set -eu
source_dir="$1"
branch="$2"
depot_tools="$3"
PATH="$depot_tools:$PATH"
export PATH
if ! command -v autoninja >/dev/null 2>&1; then
  printf '%s\\n' "autoninja is not in $depot_tools. Set depotTools in configs/builder/remote.yaml to the directory that contains it." >&2
  exit 1
fi
cd "$source_dir"
git switch --quiet --force "$branch"
${checkouts}
${SYNC_SUBMODULES}
if [ ! -f out/Default/args.gn ]; then
  mkdir -p out/Default
  cat > out/Default/args.gn << 'END_ARGS'
${argsGn.trim()}
END_ARGS
  gn gen out/Default
fi
autoninja -C out/Default chrome
`;
}

/** Moves the builder off the run branch so the push is accepted, without deleting ignored build output. */
export function detachCommand({ host, source }: { host: string; source: string }): string[] {
  return sshCommand({ host, remoteArgs: ["git", "-C", source, "switch", "--detach", "--quiet"] });
}

/**
 * Pushes one ref to the builder's checkout. The leading + in `refspec` updates that ref to match
 * this machine. This never talks to the Chromium upstream.
 */
export function pushCommand({
  host,
  repo,
  source,
  refspec,
}: {
  host: string;
  repo: string;
  source: string;
  refspec: string;
}): string[] {
  return ["git", "-C", repo, "push", "--quiet", `${host}:${source}`, refspec];
}

/** Force-updates the builder's copy of this run branch. The branch belongs to the bench, not to upstream. */
export function branchRefspec(branch: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error(`branch ${branch} has characters the builder cannot check out`);
  }

  return `+refs/heads/${branch}:refs/heads/${branch}`;
}

/** Checks the branch out on the builder and builds chrome. The script is the process stdin. */
export function buildCommand({
  host,
  source,
  branch,
  depotTools,
}: {
  host: string;
  source: string;
  branch: string;
  depotTools: string;
}): string[] {
  return sshCommand({
    host,
    remoteArgs: ["caffeinate", "-s", "bash", "-s", "--", source, branch, depotTools],
  });
}

/**
 * Copies the runnable build back. `obj/` and `gen/` stay on the builder; a component build
 * still needs `Chromium.app` and the libraries beside it.
 */
export function copyBackCommand({
  host,
  source,
  destination,
}: {
  host: string;
  source: string;
  destination: string;
}): string[] {
  return [
    "rsync",
    "-a",
    "--delete",
    "-e",
    RSYNC_SSH,
    "--exclude",
    "obj",
    "--exclude",
    "gen",
    "--exclude",
    "thinlto-cache",
    "--exclude",
    "*.ninja",
    "--exclude",
    "*.ninja_deps",
    "--exclude",
    "*.ninja_log",
    `${host}:${source}/out/Default/`,
    `${destination}/`,
  ];
}

function checkoutLine(commit: SubmoduleCommit): string {
  const path = safeRelativePath(commit.path);
  const sha = safeSha(commit.sha);

  return `git -C "$source_dir/${path}" checkout --quiet --force --detach ${sha}`;
}

function safeRelativePath(path: string): string {
  const parts = path.split("/");

  if (parts.some((part) => part === "" || part === "." || part === "..") || !/^[A-Za-z0-9._+/-]+$/.test(path)) {
    throw new Error(`submodule path is not safe to check out: ${path}`);
  }

  return path;
}

function safeSha(sha: string): string {
  if (!/^[0-9a-f]+$/.test(sha)) {
    throw new Error(`commit ${sha} is not a sha the builder can check out`);
  }

  return sha;
}
