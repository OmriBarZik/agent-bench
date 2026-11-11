import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { BenchCheck, BenchCheckInput } from "./bench-checks.types";

const DEVTOOLS_ROOT = "third_party/devtools-frontend/src/";
const GRD_LIST = "config/gni/devtools_grd_files.gni";
const NOT_BUILT = [/(^|\/)OWNERS$/, /\.md$/, /(^|\/)BUILD\.gn$/, /\.gni$/];

/**
 * Every file the agent added to the DevTools frontend must be named in a BUILD.gn or .gni file it changed. GN has
 * no globs, so a new file no build list names is not part of the build, which is how a hand-copied file looks.
 */
export async function checkBuildWiring(input: BenchCheckInput): Promise<BenchCheck> {
  const added = input.changedFiles
    .filter((file) => file.status === "A" && file.path.startsWith(DEVTOOLS_ROOT))
    .map((file) => file.path)
    .filter((path) => !NOT_BUILT.some((pattern) => pattern.test(path)));

  if (added.length === 0) {
    return {
      name: "build wiring",
      status: "review",
      detail: "No new file was added to the DevTools frontend, so the game is not wired in as new DevTools files.",
    };
  }

  const buildText = changedBuildFiles(input)
    .map((path) => readFileSync(join(input.chromiumSrc, path), "utf8"))
    .join("\n");
  const unlisted = added.filter((path) => !mentions({ buildText, path }));
  const grdChanged = input.changedFiles.some((file) => file.path === `${DEVTOOLS_ROOT}${GRD_LIST}`);

  if (unlisted.length > 0) {
    return {
      name: "build wiring",
      status: "fail",
      detail: `No changed BUILD.gn or .gni file names these new files: ${unlisted.join(", ")}.`,
    };
  }

  if (!grdChanged) {
    return {
      name: "build wiring",
      status: "review",
      detail: `Every new file is named in a build file, but ${GRD_LIST} was not changed; check the new files ship.`,
    };
  }

  return {
    name: "build wiring",
    status: "pass",
    detail: `All ${added.length} new DevTools files are named in changed build files, and ${GRD_LIST} was updated.`,
  };
}

function changedBuildFiles(input: BenchCheckInput): string[] {
  return input.changedFiles
    .filter((file) => file.status !== "D" && /(^|\/)BUILD\.gn$|\.gni$/.test(file.path))
    .map((file) => file.path)
    .filter((path) => existsSync(join(input.chromiumSrc, path)));
}

/** A build list may name the source (`Foo.ts`) or its output (`Foo.js`), so the name without extension counts. */
function mentions({ buildText, path }: { buildText: string; path: string }): boolean {
  const name = basename(path);

  return buildText.includes(name) || buildText.includes(`${name.slice(0, name.length - extname(name).length)}.`);
}
