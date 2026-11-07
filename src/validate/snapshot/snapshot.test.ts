import { $ } from "bun";
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshotTree } from "./snapshot";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an unchanged tree snapshots to HEAD", async () => {
  const repo = await submoduleRepo();

  expect(await snapshotTree(repo)).toBe(await revision({ repo, spec: "HEAD" }));
});

test("the snapshot holds edits, new files and submodule edits, and leaves HEAD, the index and the tree alone", async () => {
  const repo = await submoduleRepo();
  const headBefore = await revision({ repo, spec: "HEAD" });
  const submoduleHead = await revision({ repo: join(repo, "vendor/lib"), spec: "HEAD" });
  await Bun.write(join(repo, "top.cc"), "top2\n");
  await Bun.write(join(repo, "new.cc"), "new\n");
  await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");
  await Bun.write(join(repo, "skip.o"), "object\n");

  const snapshot = await snapshotTree(repo);

  expect(snapshot).not.toBe(headBefore);
  expect(await show({ repo, spec: `${snapshot}:top.cc` })).toBe("top2\n");
  expect(await show({ repo, spec: `${snapshot}:new.cc` })).toBe("new\n");
  expect(await $`git cat-file -e ${`${snapshot}:skip.o`}`.cwd(repo).nothrow().quiet()).toHaveProperty("exitCode", 128);
  const gitlink = await revision({ repo, spec: `${snapshot}:vendor/lib` });
  expect(gitlink).not.toBe(submoduleHead);
  expect(await show({ repo: join(repo, "vendor/lib"), spec: `${gitlink}:file.cc` })).toBe("changed\n");
  expect(await revision({ repo, spec: "HEAD" })).toBe(headBefore);
  expect(await revision({ repo: join(repo, "vendor/lib"), spec: "HEAD" })).toBe(submoduleHead);
  expect((await $`git diff --cached --name-only`.cwd(repo).text()).trim()).toBe("");
  expect(await Bun.file(join(repo, "top.cc")).text()).toBe("top2\n");
});

test("snapshotting twice without edits gives the same commit, even a second apart", async () => {
  const repo = await submoduleRepo();
  await Bun.write(join(repo, "top.cc"), "top2\n");
  await Bun.write(join(repo, "vendor/lib/file.cc"), "changed\n");

  const first = await snapshotTree(repo);
  await Bun.sleep(1_100);
  const second = await snapshotTree(repo);

  expect(second).toBe(first);
});

async function submoduleRepo(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "agent-bench-snapshot-"));
  directories.push(root);
  const source = join(root, "sub");
  const repo = join(root, "super");
  await gitInit(source);
  await Bun.write(join(source, "file.cc"), "base\n");
  await gitCommit(source);
  await gitInit(repo);
  await $`git -c protocol.file.allow=always submodule add ${source} vendor/lib`.cwd(repo).quiet();
  await Bun.write(join(repo, "top.cc"), "top\n");
  await Bun.write(join(repo, ".gitignore"), "*.o\n");
  await gitCommit(repo);
  await $`git config --remove-section submodule.vendor/lib`.cwd(repo).quiet();

  return repo;
}

async function gitInit(repo: string) {
  mkdirSync(repo, { recursive: true });
  await $`git init -q -b main`.cwd(repo).quiet();
}

async function gitCommit(repo: string) {
  await $`git add -A`.cwd(repo).quiet();
  await $`git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit --no-verify -q -m base`
    .cwd(repo)
    .quiet();
}

async function revision({ repo, spec }: { repo: string; spec: string }): Promise<string> {
  return (await $`git rev-parse --verify ${spec}`.cwd(repo).text()).trim();
}

async function show({ repo, spec }: { repo: string; spec: string }): Promise<string> {
  return $`git show ${spec}`.cwd(repo).text();
}
