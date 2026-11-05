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

// A run branch name, in any command, or the files git keeps ref names and their history in.
const RUN_BRANCH_NAME = /__r\d+__/;
const REF_STORE_PATH = /\.git\/(?:refs|packed-refs|logs)\b/;
// HEAD's reflog lists every earlier run's branch and commit, so `HEAD@{3}` reaches them too.
const GIT_ONLY_REF_WORD = /@\{|\brefs\/heads\b/;

/**
 * True when one command would reach another run's branch: its name, its ref files, or a git view wider than HEAD.
 * `program` is the command's base name and `words` its arguments. History reachable from HEAD stays allowed.
 */
export function readsOtherBranches({ program, words }: { program: string; words: readonly string[] }): boolean {
  if (words.some((word) => RUN_BRANCH_NAME.test(word) || REF_STORE_PATH.test(word))) {
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

  if (subcommand === "branch") {
    return !words.includes("--show-current");
  }

  return HISTORY_SUBCOMMANDS.has(subcommand) && words.some(isWideHistoryFlag);
}

function isWideHistoryFlag(word: string): boolean {
  return WIDE_HISTORY_FLAGS.has(word) || WIDE_HISTORY_FLAG_PREFIXES.some((prefix) => word.startsWith(prefix));
}
