#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, statSync } from "node:fs";
import { totalmem } from "node:os";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");

/**
 * Indexes each nested git checkout that the Chromium index leaves out.
 *
 *   bun configs/setup/codebase-memory/index-subrepos.ts
 *
 * Reads directory lines from CHROMIUM_SRC/.cbmignore (default ../src). When that
 * file is missing, discovers nested .git directories instead. Each repo is indexed
 * on its own, with CBM_MEM_BUDGET_MB set to total RAM. A failure is reported and
 * the rest still run.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  const repos = await ignoredRepos({ checkout: CHECKOUT });

  if (repos.length === 0) {
    throw new Error(`no nested git checkouts under ${CHECKOUT}`);
  }

  const budgetMb = String(memoryBudgetMb());
  const failed: string[] = [];

  for (let index = 0; index < repos.length; index++) {
    const repoPath = repos[index] ?? "";
    console.log(`indexing ${index + 1}/${repos.length} ${repoPath}`);
    const result = await $`codebase-memory-mcp cli --progress index_repository --repo-path ${repoPath}`
      .cwd(REPO_ROOT)
      .env({ ...process.env, CBM_MEM_BUDGET_MB: budgetMb })
      .nothrow();

    if (result.exitCode !== 0) {
      console.error(`index failed (${result.exitCode}) ${repoPath}`);
      failed.push(repoPath);
    }
  }

  if (failed.length > 0) {
    throw new Error(`index_repository failed for ${failed.length} repo(s):\n${failed.join("\n")}`);
  }
}

/** All physical RAM, in MiB. The indexer will not take more than this. */
function memoryBudgetMb(): number {
  return Math.floor(totalmem() / 1024 / 1024);
}

/** Directory lines in .cbmignore, or every nested git checkout when that file is absent. */
async function ignoredRepos({ checkout }: { checkout: string }): Promise<string[]> {
  const ignoreFile = resolve(checkout, ".cbmignore");

  if (existsSync(ignoreFile)) {
    const listed = directoriesInIgnore({ checkout, text: await Bun.file(ignoreFile).text() });

    if (listed.length === 0) {
      throw new Error(`.cbmignore in ${checkout} lists no directories`);
    }

    return listed;
  }

  console.log(`no .cbmignore in ${checkout}; indexing every nested git checkout`);

  return discoverNestedRepos({ checkout });
}

/** Existing directories named by .cbmignore. Patterns and comments are skipped. */
function directoriesInIgnore({ checkout, text }: { checkout: string; text: string }): string[] {
  const repos: string[] = [];

  for (const line of text.split("\n")) {
    const pattern = line.trim();

    if (pattern === "" || pattern.startsWith("#") || pattern.startsWith("!")) {
      continue;
    }

    const relative = pattern.replace(/^\//, "").replace(/\/$/, "");
    const repoPath = resolve(checkout, relative);

    if (!existsSync(repoPath) || !statSync(repoPath).isDirectory()) {
      continue;
    }

    repos.push(repoPath);
  }

  return repos;
}

/** Parent directory of every .git under checkout, except the checkout's own .git. */
async function discoverNestedRepos({ checkout }: { checkout: string }): Promise<string[]> {
  const found = await $`find . -name .git -prune`.cwd(checkout).text();
  const repos: string[] = [];

  for (const line of found.split("\n")) {
    const gitPath = line.trim();

    if (gitPath === "" || gitPath === ".git" || gitPath === "./.git") {
      continue;
    }

    const relative = gitPath.replace(/^\.\//, "").replace(/\/\.git$/, "");
    repos.push(resolve(checkout, relative));
  }

  repos.sort();

  return repos;
}

if (import.meta.main) {
  await main();
}
