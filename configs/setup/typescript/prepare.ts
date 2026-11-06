#!/usr/bin/env bun

const FIX = "bun install -g typescript";

/**
 * Checks that TypeScript 7's tsc is on PATH.
 *
 *   bun run setup:typescript
 *
 * The language server is `tsc --lsp --stdio`. TypeScript 6's tsc does not
 * provide that flag. This command does not install it.
 */
function main(): void {
  const compiler = Bun.which("tsc");

  if (compiler == null) {
    throw new Error(
      `TypeScript 7's tsc is not on PATH. Install it, open a new shell, then run bun run setup:typescript again.\n${FIX}`,
    );
  }

  const version = Bun.spawnSync([compiler, "--version"], { stdout: "pipe", stderr: "pipe" });
  const versionText = version.stdout.toString().trim();
  const major = typescriptMajor(versionText);

  if (version.exitCode !== 0 || major == null || major < 7) {
    const found = versionText === "" ? "no version" : versionText;

    throw new Error(
      `TypeScript 7's tsc is required for tsc --lsp (found ${found} at ${compiler}). TypeScript 6 does not ship that language server.\n${FIX}`,
    );
  }

  console.log(`tsc: ${compiler}`);
  console.log(versionText);
}

function typescriptMajor(versionText: string): number | null {
  const match = /Version\s+(\d+)\./.exec(versionText);

  if (match?.[1] == null) {
    return null;
  }

  return Number(match[1]);
}

if (import.meta.main) {
  main();
}
