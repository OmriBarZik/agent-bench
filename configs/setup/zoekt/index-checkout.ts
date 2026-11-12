#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");
const INDEX_DIR = join(homedir(), ".zoekt");
const IGNORED_DIRS = ".git,.hg,.svn,out";

/**
 * Rebuilds the Zoekt index the zoekt command searches for the Chromium checkout.
 *
 *   bun run setup:zoekt-index
 *
 * CHROMIUM_SRC overrides the checkout (default ../src). The shards go to ~/.zoekt,
 * the directory zoekt reads when -index_dir is not passed. Directories named .git, .hg,
 * .svn, or out are skipped at every depth. ctags is off, so the index has no symbol data.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  console.log(`zoekt-index ${CHECKOUT} into ${INDEX_DIR}`);
  const result = await $`zoekt-index -index ${INDEX_DIR} -ignore_dirs ${IGNORED_DIRS} -disable_ctags ${CHECKOUT}`
    .cwd(REPO_ROOT)
    .nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`zoekt-index failed (${result.exitCode})`);
  }
}

if (import.meta.main) {
  await main();
}
