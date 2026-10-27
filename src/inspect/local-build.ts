import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { checkoutBranch, hasUncommittedChanges } from "../runner/chromium/chromium";
import { BENCH_DIR } from "../paths";
import { failureNotice, runStep, waitForReturn } from "./build-process";
import type { RunChoice } from "./select-state.types";

const BUILDER_ARGS = join(BENCH_DIR, "configs/builder/args.gn");

/** Checks the run out in the local Chromium tree, builds chrome there, and opens the app. */
export async function presentLocalBuild({
  choice,
  chromiumSrc,
  force,
  signal,
}: {
  choice: RunChoice;
  chromiumSrc: string;
  force: boolean;
  signal: AbortSignal;
}): Promise<string> {
  try {
    const built = await buildLocally({ choice, chromiumSrc, force, signal });
    console.log(`\n${built}`);
    await waitForReturn(signal);

    return built;
  } catch (error) {
    const notice = failureNotice({ error, signal });
    console.error(`\n${notice}`);

    if (!signal.aborted) {
      await waitForReturn(signal);
    }

    return notice;
  }
}

/** The autoninja command a local build runs, with the Chromium checkout as its working directory. */
export function localBuildCommand(): string[] {
  return ["caffeinate", "-s", "autoninja", "-C", "out/Default", "chrome"];
}

async function buildLocally({
  choice,
  chromiumSrc,
  force,
  signal,
}: {
  choice: RunChoice;
  chromiumSrc: string;
  force: boolean;
  signal: AbortSignal;
}): Promise<string> {
  console.log(`Building ${choice.branch} in ${chromiumSrc}`);
  console.log("Ctrl-C cancels and returns to the list.");
  await checkOutRun({ choice, chromiumSrc, force });
  await ensureBuildArgs({ chromiumSrc, signal });

  if (Bun.which("autoninja") == null) {
    throw new Error("autoninja is not on PATH. Install depot_tools on this Mac and start inspect from that shell.");
  }

  await runStep({ command: localBuildCommand(), signal, label: "build", cwd: chromiumSrc });
  const app = join(chromiumSrc, "out/Default/Chromium.app");

  if (!existsSync(app)) {
    throw new Error(`the build finished, but ${app} is missing`);
  }

  await runStep({ command: ["open", app], signal, label: "open" });

  return `built ${choice.branch} at ${app}`;
}

async function checkOutRun({ choice, chromiumSrc, force }: { choice: RunChoice; chromiumSrc: string; force: boolean }) {
  if (!force && (await hasUncommittedChanges(chromiumSrc))) {
    throw new Error(`${chromiumSrc} has uncommitted changes; commit/stash them or pass --force`);
  }

  await checkoutBranch({ branch: choice.branch, force, repo: chromiumSrc });
}

async function ensureBuildArgs({ chromiumSrc, signal }: { chromiumSrc: string; signal: AbortSignal }) {
  const argsPath = join(chromiumSrc, "out/Default/args.gn");

  if (existsSync(argsPath)) {
    return;
  }

  const argsGn = await Bun.file(BUILDER_ARGS).text();

  if (argsGn.trim() === "") {
    throw new Error(`write the build args in ${BUILDER_ARGS}`);
  }

  if (Bun.which("gn") == null) {
    throw new Error("gn is not on PATH. Install depot_tools on this Mac and start inspect from that shell.");
  }

  await mkdir(join(chromiumSrc, "out/Default"), { recursive: true });
  await Bun.write(argsPath, argsGn.endsWith("\n") ? argsGn : `${argsGn}\n`);
  await runStep({
    command: ["gn", "gen", "out/Default"],
    signal,
    label: "gn gen",
    cwd: chromiumSrc,
  });
}
