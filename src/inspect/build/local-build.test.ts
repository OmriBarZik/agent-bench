import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openChromiumCommand } from "./build-process";
import { extendPathForCcache, prepareCcacheScript } from "./ccache";
import { localBuildCommand } from "./local-build";

test("the local build runs chrome in this checkout", () => {
  expect(localBuildCommand()).toEqual(["caffeinate", "-s", "autoninja", "-C", "out/Default", "chrome"]);
});

test("opening Chromium skips the keychain prompt and Cast device scan", () => {
  expect(openChromiumCommand("/builds/run/Chromium.app")).toEqual([
    "open",
    "/builds/run/Chromium.app",
    "--args",
    "--use-mock-keychain",
    "--disable-features=DialMediaRouteProvider",
  ]);
});

test("extendPathForCcache leaves a path that already contains ccache", () => {
  const directory = mkdtempSync(join(tmpdir(), "ccache-path-"));
  writeFileSync(join(directory, "ccache"), "");
  const commandPath = `/usr/bin:${directory}`;

  try {
    expect(extendPathForCcache(commandPath)).toBe(commandPath);
    const extended = extendPathForCcache("/usr/bin:/bin");

    if (extended === "/usr/bin:/bin") {
      expect(existsSync("/opt/homebrew/bin/ccache") || existsSync("/usr/local/bin/ccache")).toBe(false);
    } else {
      const added = extended.slice("/usr/bin:/bin:".length);

      expect(existsSync(join(added, "ccache"))).toBe(true);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ccache prepare raises a ceiling below 50 GiB and leaves a larger one", async () => {
  expect(await recordedCcacheConfig("5.0 GiB")).toContain("--set-config max_size=50GiB");
  expect(await recordedCcacheConfig("50.0 GiB")).not.toContain("--set-config");
  expect(await recordedCcacheConfig("60.0 GiB")).not.toContain("--set-config");
});

/** Runs the prepare script against a fake ccache that reports `reportedSize` and records its arguments. */
async function recordedCcacheConfig(reportedSize: string): Promise<string> {
  const directory = mkdtempSync(join(tmpdir(), "ccache-prepare-"));
  const log = join(directory, "log");
  const binary = join(directory, "ccache");
  writeFileSync(
    binary,
    `#!/bin/sh
printf '%s\\n' "$1 $2" >> ${shellQuote(log)}
if [ "$1" = "--get-config" ]; then
  printf '%s\\n' ${shellQuote(reportedSize)}
  exit 0
fi
exit 0
`,
  );
  chmodSync(binary, 0o755);

  try {
    const subprocess = Bun.spawn(["/bin/bash", "-c", prepareCcacheScript()], {
      env: { HOME: directory, PATH: `${directory}:/usr/bin:/bin` },
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await subprocess.exited;
    const stderr = await new Response(subprocess.stderr).text();

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return await Bun.file(log).text();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
