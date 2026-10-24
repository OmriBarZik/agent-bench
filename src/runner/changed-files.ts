import { $ } from "bun";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { ChangedFile } from "../db.types";
import { changedFileFromEntry, parseRawDiff } from "./raw-diff";
import type { RawDiffEntry } from "./raw-diff.types";

/** git's well-known empty tree. Diffing against it lists every file in a newly added submodule. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const GITLINK = "160000";

/** Every path that differs between the index and `baseSha`, with submodule gitlinks expanded to files. */
export async function changedFilesSince({ repo, baseSha }: { repo: string; baseSha: string }): Promise<ChangedFile[]> {
  const raw = await $`git diff --cached --raw -z --abbrev=40 --ignore-submodules=none ${baseSha} --`.cwd(repo).text();

  return collectChangedFiles({ repo, raw, prefix: "" });
}

async function collectChangedFiles({
  repo,
  raw,
  prefix,
}: {
  repo: string;
  raw: string;
  prefix: string;
}): Promise<ChangedFile[]> {
  const changedFiles: ChangedFile[] = [];

  for (const entry of parseRawDiff(raw)) {
    if (entry.oldMode === GITLINK || entry.newMode === GITLINK) {
      changedFiles.push(...(await expandGitlink({ repo, entry, prefix })));

      continue;
    }

    changedFiles.push(prefixChangedFile({ prefix, file: changedFileFromEntry(entry) }));
  }

  return changedFiles;
}

async function expandGitlink({
  repo,
  entry,
  prefix,
}: {
  repo: string;
  entry: RawDiffEntry;
  prefix: string;
}): Promise<ChangedFile[]> {
  const oldSha = treeSha({ mode: entry.oldMode, sha: entry.oldSha });
  const newSha = treeSha({ mode: entry.newMode, sha: entry.newSha });

  if (oldSha === newSha) {
    return [];
  }

  const directory = join(repo, entry.path);
  const raw = await readTreeDiff({ repo, directory, relativePath: entry.path, oldSha, newSha });

  if (raw === null) {
    return [prefixChangedFile({ prefix, file: changedFileFromEntry(entry) })];
  }

  return collectChangedFiles({ repo: directory, raw, prefix: joinPrefix(prefix, entry.path) });
}

async function readTreeDiff({
  repo,
  directory,
  relativePath,
  oldSha,
  newSha,
}: {
  repo: string;
  directory: string;
  relativePath: string;
  oldSha: string;
  newSha: string;
}): Promise<string | null> {
  if (existsSync(join(directory, ".git"))) {
    return $`git diff --raw -z --abbrev=40 --ignore-submodules=none ${oldSha} ${newSha}`.cwd(directory).text();
  }

  const gitDir = await moduleGitDir({ repo, relativePath });

  if (!gitDir) {
    return null;
  }

  // The modules git dir still points at the deleted worktree. Two-commit diff never reads the work tree;
  // a stand-in directory stops git from chdir'ing into the missing checkout.
  return $`git --git-dir=${gitDir} --work-tree=${repo} diff --raw -z --abbrev=40 --ignore-submodules=none ${oldSha} ${newSha}`.text();
}

async function moduleGitDir({ repo, relativePath }: { repo: string; relativePath: string }): Promise<string | null> {
  if (!existsSync(join(repo, ".git"))) {
    return null;
  }

  const result = await $`git rev-parse --git-dir`.cwd(repo).nothrow().quiet();

  if (result.exitCode !== 0) {
    return null;
  }

  const printed = result.text().trim();
  const gitDir = isAbsolute(printed) ? printed : join(repo, printed);
  const modules = join(gitDir, "modules", relativePath);

  if (!existsSync(join(modules, "HEAD"))) {
    return null;
  }

  return modules;
}

function treeSha({ mode, sha }: { mode: string; sha: string }): string {
  if (mode !== GITLINK || /^0+$/.test(sha)) {
    return EMPTY_TREE;
  }

  return sha;
}

function prefixChangedFile({ prefix, file }: { prefix: string; file: ChangedFile }): ChangedFile {
  const prefixed: ChangedFile = { status: file.status, path: joinPrefix(prefix, file.path) };

  if (file.previousPath) {
    prefixed.previousPath = joinPrefix(prefix, file.previousPath);
  }

  return prefixed;
}

function joinPrefix(prefix: string, path: string): string {
  if (prefix === "") {
    return path;
  }

  return `${prefix}/${path}`;
}
