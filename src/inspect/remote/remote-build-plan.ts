import { RSYNC_SSH, sshCommand } from "../../builder/ssh";
import { prepareCcacheScript } from "../build/ccache";
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

/**
 * Shell that checks out a revision on the builder and builds a ninja target. Args are source, revision, depot_tools.
 * The revision is a branch name or a commit sha. A build already running in out/Default finishes first.
 */
export function remoteBuildScript({
  argsGn,
  commits,
  ninjaTarget = "chrome",
}: {
  argsGn: string;
  commits: SubmoduleCommit[];
  /** Ninja target. Defaults to `chrome` for Runs-tab builds. */
  ninjaTarget?: string;
}): string {
  if (argsGn.includes("END_ARGS")) {
    throw new Error("configs/builder/args.gn cannot contain END_ARGS");
  }

  const target = safeNinjaTarget(ninjaTarget);
  const checkouts = commits.map((commit) => checkoutLine(commit)).join("\n");

  return `set -eu
source_dir="$1"
revision="$2"
depot_tools="$3"
PATH="$depot_tools:$PATH"
export PATH
if ! command -v autoninja >/dev/null 2>&1; then
  printf '%s\\n' "autoninja is not in $depot_tools. Set depotTools in configs/builder/remote.yaml to the directory that contains it." >&2
  exit 1
fi
cd "$source_dir"
while pgrep -f -- '-C out/Default' >/dev/null 2>&1; do
  printf '%s\\n' "waiting for another build of out/Default to finish"
  sleep 10
done
git checkout --quiet --force "$revision"
${checkouts}
${SYNC_SUBMODULES}
${prepareCcacheScript()}mkdir -p out/Default
desired_args=$(mktemp)
previous_args=$(mktemp)
cat > "$desired_args" << 'END_ARGS'
${argsGn.trim()}
END_ARGS
had_args=0
if [ -f out/Default/args.gn ]; then
  cp out/Default/args.gn "$previous_args"
  had_args=1
fi
if [ ! -f out/Default/args.gn ] || ! cmp -s out/Default/args.gn "$desired_args"; then
  cp "$desired_args" out/Default/args.gn
  if ! gn gen out/Default; then
    if [ "$had_args" -eq 1 ]; then
      cp "$previous_args" out/Default/args.gn
    else
      rm -f out/Default/args.gn
    fi
    rm -f "$desired_args" "$previous_args"
    exit 1
  fi
fi
rm -f "$desired_args" "$previous_args"
# SSH has no tty, so siso turns fast local off. Pass it back on, as the build log says.
autoninja --fast_local -C out/Default ${target}
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

/** Checks `revision` (a branch or a commit sha) out on the builder and builds chrome. The script is the process stdin. */
export function buildCommand({
  host,
  source,
  revision,
  depotTools,
}: {
  host: string;
  source: string;
  revision: string;
  depotTools: string;
}): string[] {
  return sshCommand({
    host,
    remoteArgs: ["caffeinate", "-s", "bash", "-s", "--", source, revision, depotTools],
  });
}

/**
 * Copies the runnable chrome build back. `obj/` and `gen/` stay on the builder; a component build
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

/**
 * Shell that copies selected paths under the builder's `out/Default/` into `destination`,
 * preserving their relative layout. Used for light validate modes that only need gen/ output.
 */
export function copyPathsScript({
  host,
  source,
  destination,
  relativePaths,
}: {
  host: string;
  source: string;
  destination: string;
  relativePaths: string[];
}): string {
  const lines = relativePaths.map((path) => {
    const safe = safeRelativePath(path);

    return `mkdir -p ${shellSingleQuote(`${destination}/${safe}`)}
rsync -a --delete -e ${shellSingleQuote(RSYNC_SSH)} ${shellSingleQuote(`${host}:${source}/out/Default/${safe}/`)} ${shellSingleQuote(`${destination}/${safe}/`)}`;
  });

  return `set -eu
${lines.join("\n")}
`;
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function checkoutLine(commit: SubmoduleCommit): string {
  const path = safeRelativePath(commit.path);
  const sha = safeSha(commit.sha);

  return `git -C "$source_dir/${path}" checkout --quiet --force --detach ${sha}`;
}

function safeRelativePath(path: string): string {
  const parts = path.split("/");

  if (parts.some((part) => part === "" || part === "." || part === "..") || !/^[A-Za-z0-9._+/-]+$/.test(path)) {
    throw new Error(`path is not safe to use remotely: ${path}`);
  }

  return path;
}

function safeNinjaTarget(target: string): string {
  if (!/^[A-Za-z0-9._+/-:]+$/.test(target) || target.includes("..")) {
    throw new Error(`ninja target is not safe to build: ${target}`);
  }

  return target;
}

function safeSha(sha: string): string {
  if (!/^[0-9a-f]+$/.test(sha)) {
    throw new Error(`commit ${sha} is not a sha the builder can check out`);
  }

  return sha;
}
