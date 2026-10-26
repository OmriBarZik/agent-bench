#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { totalmem } from "node:os";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");

/**
 * Indexes the whole Chromium checkout, using all physical RAM as the budget.
 *
 *   bun configs/setup/codebase-memory/index-checkout.ts
 *
 * CHROMIUM_SRC overrides the checkout (default ../src). CBM_MEM_BUDGET_MB is set
 * to total RAM; codebase-memory-mcp clamps a larger value down to that.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  const budgetMb = String(memoryBudgetMb());
  const result = await $`codebase-memory-mcp cli --progress index_repository --repo-path ${CHECKOUT}`
    .cwd(REPO_ROOT)
    .env({ ...process.env, CBM_MEM_BUDGET_MB: budgetMb })
    .nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`index_repository failed (${result.exitCode})`);
  }
}

/** All physical RAM, in MiB. The indexer will not take more than this. */
function memoryBudgetMb(): number {
  return Math.floor(totalmem() / 1024 / 1024);
}

if (import.meta.main) {
  await main();
}
