import { gitSubcommand } from "./git-subcommand";

const REF_LISTING_SUBCOMMANDS = new Set([
  "for-each-ref",
  "fsck",
  "ls-remote",
  "name-rev",
  "reflog",
  "show-branch",
  "show-ref",
  "worktree",
]);
const HISTORY_SUBCOMMANDS = new Set([
  "cat-file",
  "describe",
  "log",
  "rev-list",
  "rev-parse",
  "shortlog",
  "show",
  "whatchanged",
]);
const WIDE_HISTORY_FLAGS = new Set(["--all", "--batch-all-objects", "--branches", "--reflog", "--walk-reflogs", "-g"]);
const WIDE_HISTORY_FLAG_PREFIXES = ["--branches=", "--glob="];

// A run branch name, in any command, or the files git keeps ref names, history, and objects in (submodules too).
const RUN_BRANCH_NAME = /__r\d+__/;
const REF_STORE_PATH = /\.git\/(?:\S*\/)?(?:refs|packed-refs|logs|objects|ORIG_HEAD|FETCH_HEAD)\b/;
// `git reset --hard` leaves the previous run's commit in ORIG_HEAD.
const PREVIOUS_HEAD_REF = /\b(?:ORIG_HEAD|FETCH_HEAD)\b/;
// `git checkout -` is `@{-1}`, the branch checked out before this run.
const PREVIOUS_BRANCH_SUBCOMMANDS = new Set(["checkout", "switch", "merge", "rebase", "cherry-pick"]);
// HEAD's reflog lists every earlier run's branch and commit, so `HEAD@{3}` reaches them too.
const GIT_ONLY_REF_WORD = /@\{|\brefs\/heads\b/;

/**
 * True when one command would reach another run's branch: its name, its ref files, or a git view wider than HEAD.
 * `program` is the command's base name and `words` its arguments. History reachable from HEAD stays allowed.
 */
export function readsOtherBranches({ program, words }: { program: string; words: readonly string[] }): boolean {
  if (words.some(namesOtherRun)) {
    return true;
  }

  if (program !== "git") {
    return false;
  }

  const subcommand = gitSubcommand(words);

  if (!subcommand) {
    return false;
  }

  if (REF_LISTING_SUBCOMMANDS.has(subcommand) || words.some((word) => GIT_ONLY_REF_WORD.test(word))) {
    return true;
  }

  if (PREVIOUS_BRANCH_SUBCOMMANDS.has(subcommand) && words.includes("-")) {
    return true;
  }

  if (subcommand === "branch") {
    return !words.includes("--show-current");
  }

  return HISTORY_SUBCOMMANDS.has(subcommand) && words.some(isWideHistoryFlag);
}

function isWideHistoryFlag(word: string): boolean {
  return WIDE_HISTORY_FLAGS.has(word) || WIDE_HISTORY_FLAG_PREFIXES.some((prefix) => word.startsWith(prefix));
}

/**
 * True when one word names another run's branch, git's ref or object files, or a ref that still points at an
 * earlier run. This session's own run id (BENCH_RUN_ID) is allowed, so the agent can open its own build output.
 */
export function namesOtherRun(word: string): boolean {
  const ownRunId = process.env.BENCH_RUN_ID;
  const text = ownRunId ? word.replaceAll(ownRunId, "") : word;

  return RUN_BRANCH_NAME.test(text) || REF_STORE_PATH.test(text) || PREVIOUS_HEAD_REF.test(text);
}
