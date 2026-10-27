import { $ } from "bun";
import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gitlinkCommitsBetween } from "./gitlink-commits";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("gitlink commits are the submodule shas between two revisions", async () => {
  const root = mkdtempSync(join(import.meta.dir, "gitlink-test-"));
  directories.push(root);
  const vendor = join(root, "vendor");
  const repo = join(root, "super");
  await commitFile({ repo: vendor, path: "file.txt", body: "hello", message: "vendor" });
  const sha = (await $`git rev-parse HEAD`.cwd(vendor).text()).trim();
  await commitFile({ repo, path: "README", body: "base", message: "base" });
  const base = (await $`git rev-parse HEAD`.cwd(repo).text()).trim();
  await $`git update-index --add --cacheinfo ${`160000,${sha},vendor`}`.cwd(repo).quiet();
  await $`git -c user.email=test@example.com -c user.name=test commit -m link`.cwd(repo).quiet();
  await commitFile({ repo, path: "extra.txt", body: "x", message: "file" });
  const tip = (await $`git rev-parse HEAD`.cwd(repo).text()).trim();
  const commits = await gitlinkCommitsBetween({ repo, base, tip });

  expect(commits).toEqual([{ path: "vendor", sha }]);
});

async function commitFile({
  repo,
  path,
  body,
  message,
}: {
  repo: string;
  path: string;
  body: string;
  message: string;
}) {
  if (!existsSync(join(repo, ".git"))) {
    mkdirSync(repo, { recursive: true });
    await $`git init -b main`.cwd(repo).quiet();
  }

  await Bun.write(join(repo, path), body);
  await $`git add ${path}`.cwd(repo).quiet();
  await $`git -c user.email=test@example.com -c user.name=test commit -m ${message}`.cwd(repo).quiet();
}
