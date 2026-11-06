#!/usr/bin/env bun

/**
 * Checks that the TypeScript language server is on PATH.
 *
 *   bun run setup:typescript
 *
 * The binary has to resolve in the shell that launches bun run start.
 * This command does not install it.
 */
async function main(): Promise<void> {
  const languageServer = Bun.which("typescript-language-server");
  const tsserver = Bun.which("tsserver");

  if (!languageServer || !tsserver) {
    throw new Error(
      "typescript-language-server and tsserver must be on PATH. Install them, open a new shell, then run bun run setup:typescript again.\nbun install -g typescript-language-server typescript@6",
    );
  }

  console.log(`typescript-language-server: ${languageServer}`);
  console.log(`tsserver: ${tsserver}`);
}

if (import.meta.main) {
  await main();
}
