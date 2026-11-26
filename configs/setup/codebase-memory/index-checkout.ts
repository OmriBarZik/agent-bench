#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { homedir, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { requirePristineTree, writeIndexStamp } from "../../../src/setup/index-stamp/pristine-index";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");
const CACHE_DIR = process.env.CBM_CACHE_DIR || join(homedir(), ".cache", "codebase-memory-mcp");

/**
 * Indexes the whole Chromium checkout, using all physical RAM as the budget.
 *
 *   bun configs/setup/codebase-memory/index-checkout.ts
 *
 * CHROMIUM_SRC overrides the checkout (default ../src). CBM_MEM_BUDGET_MB is set
 * to total RAM; codebase-memory-mcp clamps a larger value down to that. Refuses to run unless the checkout is
 * clean (submodules included) and at the tasks' chromiumSha. CBM_CACHE_DIR/index-stamp.json records the SHA and
 * tree state; the Setups tab compares it with the tasks.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  const stamp = await requirePristineTree({ tool: "codebase-memory", checkout: CHECKOUT });
  const budgetMb = String(memoryBudgetMb());
  const result = await $`codebase-memory-mcp cli --progress index_repository --repo-path ${CHECKOUT}`
    .cwd(REPO_ROOT)
    .env({ ...process.env, CBM_MEM_BUDGET_MB: budgetMb })
    .nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`index_repository failed (${result.exitCode})`);
  }

  await writeIndexStamp({ stamp, path: join(CACHE_DIR, "index-stamp.json") });
}

/** All physical RAM, in MiB. The indexer will not take more than this. */
function memoryBudgetMb(): number {
  return Math.floor(totalmem() / 1024 / 1024);
}

if (import.meta.main) {
  await main();
}
