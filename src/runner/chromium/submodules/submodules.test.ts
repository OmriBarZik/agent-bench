import { $ } from "bun";
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChangedFile } from "../../../db/db.types";
import {
  checkoutBranch,
  commitRunChanges,
  hasUncommittedChanges,
  resetChromium,
  restoreCommittedTree,
} from "../chromium";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "agent-bench-sub-"));
  directories.push(root);

  return root;
}

describe("submodule file changes", () => {
  test("commitRunChanges saves and reports files inside a deinitialized submodule", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    await $`git switch -q -C run`.cwd(repo).quiet();
    await Bun.write(join(repo, "top.cc"), "top2\n");
    await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
    await Bun.write(join(repo, "vendor/lib/new.cc"), "new\n");
    await $`git mv dir/a.cc dir/b.cc`.cwd(join(repo, "vendor/lib")).quiet();

    const artifact = await commitRunChanges({ branch: "run", baseSha, message: "run", repo });

    expect(artifact.commitSha).not.toBeNull();
    expect(sorted(artifact.changedFiles)).toEqual(
      sorted([
        { status: "M", path: "top.cc" },
        { status: "A", path: "vendor/lib/new.cc" },
        { status: "M", path: "vendor/lib/file.cc" },
        { status: "R", path: "vendor/lib/dir/b.cc", previousPath: "vendor/lib/dir/a.cc" },
      ]),
    );
    expect(await headAt({ repo, path: "vendor/lib" })).toBe(await head(join(repo, "vendor/lib")));
    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("changed\n");
  });

  test("resetChromium clears tracked and untracked submodule files and keeps ignored ones", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
    await Bun.write(join(repo, "vendor/lib/junk.cc"), "junk\n");
    await Bun.write(join(repo, "vendor/lib/keep.o"), "object\n");
    await Bun.write(join(repo, "top.cc"), "top2\n");
    expect(await hasUncommittedChanges(repo)).toBe(true);

    await resetChromium({ sha: baseSha, repo });

    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("base\n");
    expect(await Bun.file(join(repo, "top.cc")).text()).toBe("top\n");
    expect(existsSync(join(repo, "vendor/lib/junk.cc"))).toBe(false);
    expect(await Bun.file(join(repo, "vendor/lib/keep.o")).text()).toBe("object\n");
    expect(await hasUncommittedChanges(repo)).toBe(false);
  });

  test("untracked files inside a submodule are not uncommitted changes", async () => {
    const repo = await submoduleRepo();
    await Bun.write(join(repo, "vendor/lib/junk.cc"), "junk\n");

    expect(await hasUncommittedChanges(repo)).toBe(false);
  });

  test("checkoutBranch restores the submodule commit recorded on the run branch", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    await $`git switch -q -C run`.cwd(repo).quiet();
    await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
    await commitRunChanges({ branch: "run", baseSha, message: "run", repo });
    await resetChromium({ sha: baseSha, repo });
    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("base\n");

    await checkoutBranch({ branch: "run", repo });

    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("changed\n");
    expect(await headAt({ repo, path: "vendor/lib" })).toBe(await head(join(repo, "vendor/lib")));
  });

  test("checkoutBranch without force refuses to overwrite a dirty submodule", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    await $`git switch -q -C run`.cwd(repo).quiet();
    await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
    await commitRunChanges({ branch: "run", baseSha, message: "run", repo });
    await resetChromium({ sha: baseSha, repo });
    await Bun.write(join(repo, "vendor/lib/file.cc"), "dirty\n");

    await expect(checkoutBranch({ branch: "run", repo })).rejects.toThrow();
    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("dirty\n");
  });

  test("checkoutBranch --force replaces a dirty submodule with the branch commit", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    await $`git switch -q -C run`.cwd(repo).quiet();
    await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
    await commitRunChanges({ branch: "run", baseSha, message: "run", repo });
    await resetChromium({ sha: baseSha, repo });
    await Bun.write(join(repo, "vendor/lib/file.cc"), "dirty\n");

    await checkoutBranch({ branch: "run", force: true, repo });

    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("changed\n");
  });

  test("commitRunChanges reports a file inside a nested submodule", async () => {
    const repo = await nestedRepo();
    const baseSha = await head(repo);
    await Bun.write(join(repo, "vendor/lib/mid.cc"), "mid2\n");
    await Bun.write(join(repo, "vendor/lib/nested/file.cc"), "inner2\n");

    const artifact = await commitRunChanges({ branch: "main", baseSha, message: "run", repo });

    expect(sorted(artifact.changedFiles)).toEqual(
      sorted([
        { status: "M", path: "vendor/lib/mid.cc" },
        { status: "M", path: "vendor/lib/nested/file.cc" },
      ]),
    );
    const mid = join(repo, "vendor/lib");
    expect(await headAt({ repo, path: "vendor/lib" })).toBe(await head(mid));
    expect(await headAt({ repo: mid, path: "nested" })).toBe(await head(join(mid, "nested")));
  });

  test("commitRunChanges lists files of a removed submodule", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    rmSync(join(repo, "vendor/lib"), { recursive: true, force: true });

    const artifact = await commitRunChanges({ branch: "main", baseSha, message: "run", repo });

    expect(sorted(artifact.changedFiles)).toEqual(
      sorted([
        { status: "D", path: "vendor/lib/file.cc" },
        { status: "D", path: "vendor/lib/dir/a.cc" },
        { status: "D", path: "vendor/lib/.gitignore" },
      ]),
    );
  });

  test("restoreCommittedTree drops a later submodule commit and untracked files", async () => {
    const repo = await submoduleRepo();
    const baseSha = await head(repo);
    await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
    await commitRunChanges({ branch: "main", baseSha, message: "run", repo });
    await Bun.write(join(repo, "vendor/lib/file.cc"), "judge\n");
    await Bun.write(join(repo, "vendor/lib/junk.cc"), "junk\n");
    await gitCommit(join(repo, "vendor/lib"), "judge");

    await restoreCommittedTree(repo);

    expect(await Bun.file(join(repo, "vendor/lib/file.cc")).text()).toBe("changed\n");
    expect(existsSync(join(repo, "vendor/lib/junk.cc"))).toBe(false);
    expect(await headAt({ repo, path: "vendor/lib" })).toBe(await head(join(repo, "vendor/lib")));
  });

  test("resetChromium resets a repository that has no submodules", async () => {
    const root = tempRoot();
    const repo = join(root, "super");
    await gitInit(repo);
    await Bun.write(join(repo, "top.cc"), "top\n");
    await gitCommit(repo, "base");
    const baseSha = await head(repo);
    await Bun.write(join(repo, "top.cc"), "top2\n");

    await resetChromium({ sha: baseSha, repo });

    expect(await Bun.file(join(repo, "top.cc")).text()).toBe("top\n");
    expect(await hasUncommittedChanges(repo)).toBe(false);
  });
});

async function submoduleRepo(): Promise<string> {
  const root = tempRoot();
  const source = join(root, "sub");
  const repo = join(root, "super");
  await gitInit(source);
  mkdirSync(join(source, "dir"));
  await Bun.write(join(source, "file.cc"), "base\n");
  await Bun.write(join(source, "dir/a.cc"), "a\n");
  await Bun.write(join(source, ".gitignore"), "*.o\n");
  await gitCommit(source, "base");
  await gitInit(repo);
  await $`git config diff.ignoreSubmodules dirty`.cwd(repo).quiet();
  await $`git -c protocol.file.allow=always submodule add ${source} vendor/lib`.cwd(repo).quiet();
  await Bun.write(join(repo, "top.cc"), "top\n");
  await gitCommit(repo, "super");
  await $`git config --remove-section submodule.vendor/lib`.cwd(repo).quiet();

  return repo;
}

async function nestedRepo(): Promise<string> {
  const root = tempRoot();
  const inner = join(root, "inner");
  const midSource = join(root, "mid");
  const repo = join(root, "super");
  await gitInit(inner);
  await Bun.write(join(inner, "file.cc"), "inner\n");
  await gitCommit(inner, "inner");
  await gitInit(midSource);
  await Bun.write(join(midSource, "mid.cc"), "mid\n");
  await gitCommit(midSource, "mid");
  await gitInit(repo);
  await $`git config diff.ignoreSubmodules dirty`.cwd(repo).quiet();
  await $`git -c protocol.file.allow=always submodule add ${midSource} vendor/lib`.cwd(repo).quiet();
  await gitCommit(repo, "super");
  const mid = join(repo, "vendor/lib");
  await $`git config diff.ignoreSubmodules dirty`.cwd(mid).quiet();
  await $`git -c protocol.file.allow=always submodule add ${inner} nested`.cwd(mid).quiet();
  await gitCommit(mid, "nested");
  await gitCommit(repo, "link");
  await $`git config --remove-section submodule.vendor/lib`.cwd(repo).quiet();
  await $`git config --remove-section submodule.nested`.cwd(mid).quiet();

  return repo;
}

async function gitInit(repo: string) {
  mkdirSync(repo, { recursive: true });
  await $`git init -q -b main`.cwd(repo).quiet();
  await $`git config user.email test@example.com`.cwd(repo).quiet();
  await $`git config user.name test`.cwd(repo).quiet();
  await $`git config commit.gpgsign false`.cwd(repo).quiet();
  await $`git config core.autocrlf false`.cwd(repo).quiet();
}

async function gitCommit(repo: string, message: string) {
  await $`git add -A`.cwd(repo).quiet();
  await $`git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit --no-verify -q -m ${message}`
    .cwd(repo)
    .quiet();
}

async function head(repo: string): Promise<string> {
  return (await $`git rev-parse --verify HEAD`.cwd(repo).text()).trim();
}

async function headAt({ repo, path }: { repo: string; path: string }): Promise<string> {
  return (await $`git rev-parse --verify HEAD:${path}`.cwd(repo).text()).trim();
}

function sorted(files: ChangedFile[]): ChangedFile[] {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}
