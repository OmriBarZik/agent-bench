#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { CHROMIUM_SRC } from "../../../src/paths";
import { enableCheckoutClangd, gclientChecksOutClangd } from "./gclient-clangd";

const BUILD_DIR = "out/Default";
const MISSING_CLANGD =
  "Set checkout_clangd to True in .gclient, run gclient sync, then run bun run setup:clangd again.";

/**
 * Writes compile_commands.json for the checkout's clangd.
 *
 *   bun run setup:clangd
 *
 * Requires Chromium's clangd (`checkout_clangd` in `.gclient`) and an
 * `out/Default` gn build. When that variable is missing, asks before adding
 * it and running `gclient sync`. The database is gitignored, so a later reset keeps it.
 * Generate it at the task SHA. The current tasks share one SHA.
 */
async function main(): Promise<void> {
  const clangd = join(CHROMIUM_SRC, "third_party/llvm-build/Release+Asserts/bin/clangd");

  if (!existsSync(clangd)) {
    const enabled = await offerCheckoutClangd(clangd);

    if (!enabled) {
      throw new Error(`Chromium's clangd is missing (${clangd}). ${MISSING_CLANGD}`);
    }
  }

  const buildDir = join(CHROMIUM_SRC, BUILD_DIR);

  if (!existsSync(join(buildDir, "build.ninja"))) {
    throw new Error(
      `No ${BUILD_DIR} build in the checkout. From the checkout, run gn gen ${BUILD_DIR}, then run bun run setup:clangd again.`,
    );
  }

  const compileCommands = join(CHROMIUM_SRC, "compile_commands.json");
  const generated = await $`python3 tools/clang/scripts/generate_compdb.py -p ${BUILD_DIR} -o ${compileCommands}`
    .cwd(CHROMIUM_SRC)
    .nothrow();

  if (generated.exitCode !== 0) {
    throw new Error(`generate_compdb.py failed (${generated.exitCode}).`);
  }

  if (!existsSync(compileCommands)) {
    throw new Error(`generate_compdb.py finished, but ${compileCommands} is missing.`);
  }

  console.log(`clangd: ${clangd}`);
  console.log(`Wrote ${compileCommands}`);
}

/**
 * Asks before writing `checkout_clangd` and running `gclient sync`.
 * Returns true once clangd is on disk. Returns false when the user says no, stdin is not a terminal, or `.gclient` is missing.
 */
async function offerCheckoutClangd(clangd: string): Promise<boolean> {
  const gclientPath = join(dirname(CHROMIUM_SRC), ".gclient");

  if (!existsSync(gclientPath)) {
    return false;
  }

  const source = await Bun.file(gclientPath).text();

  if (gclientChecksOutClangd(source)) {
    return false;
  }

  const accepted = await confirmGclientUpdate(gclientPath);

  if (!accepted) {
    return false;
  }

  const updated = enableCheckoutClangd(source);
  await Bun.write(gclientPath, updated);
  console.log(`Set checkout_clangd in ${gclientPath}`);
  console.log("Running gclient sync to fetch clangd.");
  const synced = await $`gclient sync`.cwd(dirname(CHROMIUM_SRC)).nothrow();

  if (synced.exitCode !== 0) {
    throw new Error(`gclient sync failed (${synced.exitCode}).`);
  }

  if (!existsSync(clangd)) {
    throw new Error(`gclient sync finished, but Chromium's clangd is still missing (${clangd}).`);
  }

  return true;
}

async function confirmGclientUpdate(gclientPath: string): Promise<boolean> {
  if (process.stdin.isTTY !== true) {
    return false;
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await readline.question(
      `${gclientPath} does not set checkout_clangd. Add it and run gclient sync? [y/N] `,
    );
    const normalized = answer.trim().toLowerCase();

    return normalized === "y" || normalized === "yes";
  } finally {
    readline.close();
  }
}

if (import.meta.main) {
  await main();
}
