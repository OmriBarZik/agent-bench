#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CHROMIUM_SRC } from "../../../src/paths";

const BUILD_DIR = "out/Default";

/**
 * Writes compile_commands.json for the checkout's clangd.
 *
 *   bun run setup:clangd
 *
 * Requires Chromium's clangd (`checkout_clangd` in `.gclient`) and an
 * `out/Default` gn build. The database is gitignored, so a later reset keeps it.
 * Generate it at the task SHA. The current tasks share one SHA.
 */
async function main(): Promise<void> {
  const clangd = join(CHROMIUM_SRC, "third_party/llvm-build/Release+Asserts/bin/clangd");

  if (!existsSync(clangd)) {
    throw new Error(
      `Chromium's clangd is missing (${clangd}). Set checkout_clangd to True in .gclient, run gclient sync, then run bun run setup:clangd again.`,
    );
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

if (import.meta.main) {
  await main();
}
