#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");

/**
 * Rebuilds the trigram index csearch uses for the Chromium checkout.
 *
 *   bun run setup:codesearch-index
 *
 * CHROMIUM_SRC overrides the checkout (default ../src). The index is
 * $CSEARCHINDEX, or ~/.csearchindex when that is unset. cindex -reset
 * replaces it. Hidden names and build directories named out or out_* are skipped.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  const roots = indexRoots(CHECKOUT);

  if (roots.length === 0) {
    throw new Error(`nothing to index under ${CHECKOUT}`);
  }

  console.log(`cindex -reset ${roots.length} paths into ${csearchIndexPath()}`);
  const result = await $`cindex -reset ${roots}`.cwd(REPO_ROOT).nothrow();

  if (result.exitCode !== 0) {
    throw new Error(`cindex failed (${result.exitCode})`);
  }
}

/** Top-level checkout entries cindex should walk. */
function indexRoots(checkout: string): string[] {
  const roots: string[] = [];

  for (const name of readdirSync(checkout)) {
    if (isSkippedIndexEntry(name)) {
      continue;
    }

    roots.push(resolve(checkout, name));
  }

  return roots;
}

/** Hidden names, and Chromium build directories (`out`, `out_*`). */
function isSkippedIndexEntry(name: string): boolean {
  if (name.startsWith(".") || name.startsWith("#") || name.endsWith("~")) {
    return true;
  }

  if (name === "out" || name.startsWith("out_")) {
    return true;
  }

  return false;
}

/** The file cindex and csearch share. Empty CSEARCHINDEX means the default. */
function csearchIndexPath(): string {
  const configured = process.env.CSEARCHINDEX;

  if (configured) {
    return configured;
  }

  return join(homedir(), ".csearchindex");
}

if (import.meta.main) {
  await main();
}
