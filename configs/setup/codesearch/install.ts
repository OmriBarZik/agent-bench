#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CODESEARCH_MODULE = "github.com/google/codesearch/cmd/...@latest";
const CODESEARCH_COMMANDS = ["cindex", "csearch", "cgrep"];

/**
 * Installs cindex, csearch, and cgrep.
 *
 *   bun run setup:codesearch
 *
 * Requires Go 1.23 or newer. The binaries land in GOBIN, or in the first
 * GOPATH/bin when GOBIN is unset. That directory has to be on PATH before
 * bun run start, because the agent runs csearch with no directory prefix.
 */
async function main(): Promise<void> {
  const versionText = await readGoVersion();

  if (!isSupportedGo(versionText)) {
    throw new Error(
      `Go 1.23 or newer is required (${versionText}). Install a newer Go, then run bun run setup:codesearch again.`,
    );
  }

  const installed = await $`go install ${CODESEARCH_MODULE}`.cwd(REPO_ROOT).nothrow();

  if (installed.exitCode !== 0) {
    throw new Error(`go install ${CODESEARCH_MODULE} failed (${installed.exitCode})`);
  }

  const binDir = await goBinDir();

  for (const command of CODESEARCH_COMMANDS) {
    const binary = join(binDir, command);

    if (!existsSync(binary)) {
      throw new Error(`go install finished, but ${binary} is missing. Run bun run setup:codesearch again.`);
    }
  }

  if (!pathHasDir({ pathValue: process.env.PATH ?? "", binDir })) {
    throw new Error(
      `Installed cindex, csearch, and cgrep in ${binDir}. Add that directory to PATH, open a new shell, then run bun run setup:codesearch again.\nexport PATH="${binDir}:$PATH"`,
    );
  }

  console.log(`Installed cindex, csearch, and cgrep in ${binDir}`);
}

/** `go version` text, or an error that says which Go to install. */
async function readGoVersion(): Promise<string> {
  try {
    return (await $`go version`.cwd(REPO_ROOT).text()).trim();
  } catch (error) {
    // A missing go binary throws a shell error that does not name the required version.
    throw new Error("Go is not installed. Install Go 1.23 or newer, then run bun run setup:codesearch again.", {
      cause: error,
    });
  }
}

/** True when `go version` reports 1.23 or newer. */
export function isSupportedGo(versionText: string): boolean {
  const match = /go(\d+)\.(\d+)/.exec(versionText);

  if (!match?.[1] || !match[2]) {
    return false;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (major > 1) {
    return true;
  }

  return major === 1 && minor >= 23;
}

/** Directory `go install` writes to: GOBIN, otherwise the first GOPATH/bin. */
async function goBinDir(): Promise<string> {
  const gobin = (await $`go env GOBIN`.cwd(REPO_ROOT).text()).trim();

  if (gobin) {
    return gobin;
  }

  const gopath = (await $`go env GOPATH`.cwd(REPO_ROOT).text()).trim();
  const primaryGopath = gopath.split(":")[0];

  if (!primaryGopath) {
    throw new Error("go env GOPATH was empty. Set GOPATH or GOBIN, then run bun run setup:codesearch again.");
  }

  return join(primaryGopath, "bin");
}

/** True when binDir is an entry on PATH. */
export function pathHasDir({ pathValue, binDir }: { pathValue: string; binDir: string }): boolean {
  const target = resolve(binDir);

  for (const entry of pathValue.split(":")) {
    if (!entry) {
      continue;
    }

    if (resolve(entry) === target) {
      return true;
    }
  }

  return false;
}

if (import.meta.main) {
  await main();
}
