#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { requirePristineTree, writeIndexStamp } from "../../../src/setup/index-stamp/pristine-index";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");
const INDEX_DIR = join(homedir(), ".zoekt");
const BUILD_DIR = `${INDEX_DIR}.building`;
const OLD_DIR = `${INDEX_DIR}.old`;
const STAMP_FILE = "index-stamp.json";
const IGNORED_DIRS = ".git,.hg,.svn,out";

/**
 * Rebuilds the Zoekt index the zoekt command searches for the Chromium checkout.
 *
 *   bun run setup:zoekt-index
 *
 * CHROMIUM_SRC overrides the checkout (default ../src). Refuses to run unless the checkout is clean
 * (submodules included) and at the tasks' chromiumSha. The shards are built in ~/.zoekt.building and then
 * replace ~/.zoekt as a whole, so no shard of an older index is left behind. ~/.zoekt/index-stamp.json records
 * the SHA and tree state; the Setups tab compares it with the tasks. Directories named .git, .hg, .svn, or
 * out are skipped at every depth. ctags is off, so the index has no symbol data.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  const stamp = await requirePristineTree({ tool: "zoekt", checkout: CHECKOUT });
  rmSync(BUILD_DIR, { recursive: true, force: true });
  console.log(`zoekt-index ${CHECKOUT} into ${BUILD_DIR}`);
  const result = await $`zoekt-index -index ${BUILD_DIR} -ignore_dirs ${IGNORED_DIRS} -disable_ctags ${CHECKOUT}`
    .cwd(REPO_ROOT)
    .nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`zoekt-index failed (${result.exitCode}); ${INDEX_DIR} is unchanged`);
  }

  await writeIndexStamp({ stamp, path: join(BUILD_DIR, STAMP_FILE) });
  rmSync(OLD_DIR, { recursive: true, force: true });

  if (existsSync(INDEX_DIR)) {
    renameSync(INDEX_DIR, OLD_DIR);
  }

  renameSync(BUILD_DIR, INDEX_DIR);
  rmSync(OLD_DIR, { recursive: true, force: true });
  console.log(`replaced ${INDEX_DIR}`);
}

if (import.meta.main) {
  await main();
}
