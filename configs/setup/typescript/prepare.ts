#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");
const FIX = "bun install -g typescript-language-server";
/** The tsserver plugins/typescript-lsp passes in initializationOptions. Chromium's third_party/node copy has no _tsserver.js. */
const TSSERVER = "third_party/devtools-frontend/src/node_modules/typescript/lib/_tsserver.js";

/**
 * Checks what plugins/typescript-lsp needs.
 *
 *   bun run setup:typescript
 *
 * typescript-language-server on PATH, node on PATH (it is a node script), and the TypeScript 6 tsserver the
 * checkout ships under third_party/devtools-frontend. TypeScript 7's `tsc --lsp` is not used: it only answers
 * pull diagnostics, and Claude Code only reads diagnostics the server publishes. This command installs nothing.
 */
function main(): void {
  const server = Bun.which("typescript-language-server");

  if (server == null) {
    throw new Error(
      `typescript-language-server is not on PATH. Install it, open a new shell, then run this again.\n${FIX}`,
    );
  }

  if (Bun.which("node") == null) {
    throw new Error(
      "node is not on PATH. typescript-language-server runs on Node.js; install it, then run this again.",
    );
  }

  const tsserver = join(CHECKOUT, TSSERVER);

  if (!existsSync(tsserver)) {
    throw new Error(
      `${tsserver} is missing. Check out third_party/devtools-frontend/src at its gitlink (gclient sync).`,
    );
  }

  const version = Bun.spawnSync([server, "--version"], { stdout: "pipe", stderr: "pipe" });
  console.log(`typescript-language-server: ${server} ${version.stdout.toString().trim()}`);
  console.log(`tsserver: ${tsserver}`);
}

if (import.meta.main) {
  main();
}
