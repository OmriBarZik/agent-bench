import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { BENCH_DIR, RUNS_DIR } from "../../src/paths";

const CLAUDE_HOME = join(homedir(), ".claude");
// Text that names the benchmark repo or Claude's saved sessions, even outside a path (a script, a query).
const PRIVATE_TEXT = /agent-bench|\.claude\/projects/;
// Search programs that walk a directory: on an ancestor of the benchmark repo they reach its files.
const WALKING_PROGRAMS = new Set(["find", "grep", "egrep", "fgrep", "rg", "ag", "sift", "fd", "tree", "du", "ls"]);

/**
 * True when `word` reaches files the agent must not see: this benchmark repo (task judges, other runs'
 * transcripts and logs) or ~/.claude (saved sessions of earlier runs). This run's own runs/<id>/ stays allowed.
 * `program` is set for a Bash word, so a directory walk from an ancestor of the repo is caught too.
 */
export function isPrivatePath({ word, cwd, program }: { word: string; cwd: string; program?: string }): boolean {
  if (isPathLike(word)) {
    const path = resolve(cwd, expandHome(word));

    if (isInside({ path, directory: ownRunDir() })) {
      return false;
    }

    if (isInside({ path, directory: BENCH_DIR }) || isInside({ path, directory: CLAUDE_HOME })) {
      return true;
    }

    if (program && WALKING_PROGRAMS.has(program) && isInside({ path: BENCH_DIR, directory: path })) {
      return true;
    }
  }

  return mentionsPrivateText(word);
}

/** True when the text names the benchmark repo or Claude's saved sessions anywhere, other than this run's own folder. */
export function mentionsPrivateText(text: string): boolean {
  return PRIVATE_TEXT.test(withoutOwnRunDir(text));
}

function isPathLike(word: string): boolean {
  return word.startsWith("/") || word.startsWith(".") || word.startsWith("~") || word.includes("/");
}

function expandHome(word: string): string {
  if (word === "~" || word.startsWith("~/")) {
    return join(homedir(), word.slice(1));
  }

  return word;
}

function isInside({ path, directory }: { path: string; directory: string }): boolean {
  const fromDirectory = relative(directory, path);

  return fromDirectory === "" || (!fromDirectory.startsWith("..") && !fromDirectory.startsWith(sep));
}

function ownRunDir(): string {
  const ownRunId = process.env.BENCH_RUN_ID;

  return ownRunId ? join(RUNS_DIR, ownRunId) : join(RUNS_DIR, "\0none");
}

function withoutOwnRunDir(word: string): string {
  const ownRunId = process.env.BENCH_RUN_ID;

  if (!ownRunId || word.includes("..")) {
    return word;
  }

  return word.replaceAll(join(RUNS_DIR, ownRunId), "");
}
