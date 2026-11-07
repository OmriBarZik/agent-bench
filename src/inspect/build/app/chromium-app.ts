import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { openDb, passedChromiumApps } from "../../../db/db";
import type { RunChoice } from "../../list/select-state.types";
import { openChromiumCommand } from "../build-process";
import { builderConfig } from "../builder-config";
import { hasChromiumAppCopy } from "./clear-app";
import type { ChromiumAppPathInput } from "./chromium-app.types";

/** Writes `chromiumAppPath` and `hasAppCopy` on each choice from builds that still exist on disk. */
export function attachChromiumApps({ choices, chromiumSrc }: { choices: RunChoice[]; chromiumSrc: string }): void {
  const buildDirectory = chromiumBuildDirectory();
  const localAppExists = existsSync(join(chromiumSrc, "out/Default/Chromium.app"));
  const db = openDb();

  try {
    const passed = passedChromiumApps(db);

    for (const choice of choices) {
      const remoteAppExists = existsSync(join(buildDirectory, choice.runId, "Chromium.app"));
      choice.hasAppCopy = hasChromiumAppCopy({ buildDirectory, runId: choice.runId });
      choice.chromiumAppPath = chromiumAppPath({
        runId: choice.runId,
        chromiumSrc,
        buildDirectory,
        latestTarget: passed.latestTarget.get(choice.runId) ?? null,
        latestLocalRunId: passed.latestLocalRunId,
        remoteAppExists,
        localAppExists,
      });
    }
  } finally {
    db.close();
  }
}

/**
 * The Chromium.app to launch for this run.
 * A build-Mac copy is per run. The local app is shared, so it counts only when this run's local build is the newest one that passed.
 * When both exist, the newer passed build wins. A copy on disk still counts when the database has no passed row.
 */
export function chromiumAppPath({
  runId,
  chromiumSrc,
  buildDirectory,
  latestTarget,
  latestLocalRunId,
  remoteAppExists,
  localAppExists,
}: ChromiumAppPathInput): string | null {
  const remoteApp = join(buildDirectory, runId, "Chromium.app");
  const localApp = join(chromiumSrc, "out/Default/Chromium.app");
  const localOwned = latestLocalRunId === runId && localAppExists;

  if (latestTarget === "local" && localOwned) {
    return localApp;
  }

  if (latestTarget === "remote" && remoteAppExists) {
    return remoteApp;
  }

  if (remoteAppExists) {
    return remoteApp;
  }

  if (localOwned) {
    return localApp;
  }

  return null;
}

/** Launches one Chromium.app and returns once `open` has handed it to launchd. */
export async function openBuiltChromium(app: string): Promise<void> {
  let subprocess: ReturnType<typeof Bun.spawn>;

  try {
    subprocess = Bun.spawn(openChromiumCommand(app), {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "pipe",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not start";

    throw new Error(`could not open Chromium: ${message}`);
  }

  const exitCode = await subprocess.exited;
  const stderrStream = subprocess.stderr;
  const stderr =
    typeof stderrStream === "number" || stderrStream == null ? "" : await new Response(stderrStream).text();

  if (exitCode !== 0) {
    const detail = stderr.trim();

    throw new Error(detail === "" ? `could not open Chromium (open exited ${exitCode})` : detail);
  }
}

/** Where per-run Chromium.app copies live (`buildDirectory` in remote.yaml, or ~/chrome-builds). */
export function chromiumBuildDirectory(): string {
  try {
    return builderConfig()?.buildDirectory ?? defaultBuildDirectory();
  } catch {
    // A broken remote.yaml is reported when a build starts. Finding an app must not take down the runs list.
    return defaultBuildDirectory();
  }
}

/** Where a copied app lives when configs/builder/remote.yaml omits buildDirectory. */
function defaultBuildDirectory(): string {
  return join(homedir(), "chrome-builds");
}
