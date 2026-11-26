import { $ } from "bun";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";
import type { TaskInputFile } from "../../db/db.types";

const BLOCK_START = "# agent-bench task inputs: start";
const BLOCK_END = "# agent-bench task inputs: end";

/**
 * Copies the task's supplied files (such as a trained model) and the config's checkoutFiles (such as an editor
 * tsconfig.json) into the freshly reset checkout and lists them in the
 * checkout's `info/exclude`, so the runner's commit, the build snapshots and the changed-file list never include
 * them. Runs for every task: inputs listed by the previous run are deleted first, because `git clean` keeps ignored
 * files. Throws when a source is missing or a destination would leave the checkout, since the run would otherwise
 * start without what its prompt promises.
 */
export async function copyTaskInputs({
  inputFiles,
  chromiumSrc,
}: {
  inputFiles: TaskInputFile[];
  chromiumSrc: string;
}) {
  const destinations = inputFiles.map((file) => checkedDestination(file));
  const excludePath = await excludeFile(chromiumSrc);
  const excludeText = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";

  for (const previous of listedInputs(excludeText)) {
    rmSync(join(chromiumSrc, previous), { recursive: true, force: true });
  }

  for (const [i, file] of inputFiles.entries()) {
    const destination = destinations[i] ?? file.to;

    if (!existsSync(file.from)) {
      throw new Error(`task input not found: ${file.from}; create it or remove it from inputFiles`);
    }

    cpSync(file.from, join(chromiumSrc, destination), { recursive: true });
  }

  mkdirSync(dirname(excludePath), { recursive: true });
  writeFileSync(excludePath, withInputs({ excludeText, destinations }));
}

/** The paths the last run listed between the markers, without their leading slash. */
export function listedInputs(excludeText: string): string[] {
  const start = excludeText.indexOf(BLOCK_START);
  const end = excludeText.indexOf(BLOCK_END);

  if (start < 0 || end < start) {
    return [];
  }

  return excludeText
    .slice(start + BLOCK_START.length, end)
    .split("\n")
    .map((line) => line.trim().replace(/^\//, ""))
    .filter((line) => line !== "");
}

/** `excludeText` with the marker block replaced by one listing `destinations`, or removed when there are none. */
export function withInputs({ excludeText, destinations }: { excludeText: string; destinations: string[] }): string {
  const start = excludeText.indexOf(BLOCK_START);
  const end = excludeText.indexOf(BLOCK_END);
  const rest =
    start >= 0 && end > start
      ? excludeText.slice(0, start) + excludeText.slice(end + BLOCK_END.length).replace(/^\n/, "")
      : excludeText;

  if (destinations.length === 0) {
    return rest;
  }

  const separator = rest === "" || rest.endsWith("\n") ? "" : "\n";
  const lines = destinations.map((destination) => `/${destination}`);

  return `${rest}${separator}${[BLOCK_START, ...lines, BLOCK_END].join("\n")}\n`;
}

function checkedDestination(file: TaskInputFile): string {
  const destination = normalize(file.to).replace(/\/+$/, "");

  if (isAbsolute(destination) || destination.startsWith("..") || destination === ".") {
    throw new Error(`task input destination must be inside the checkout: ${file.to}`);
  }

  return destination;
}

async function excludeFile(chromiumSrc: string): Promise<string> {
  const path = (await $`git rev-parse --git-path info/exclude`.cwd(chromiumSrc).text()).trim();

  return isAbsolute(path) ? path : join(chromiumSrc, path);
}
