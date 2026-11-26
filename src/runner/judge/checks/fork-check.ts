import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { BenchCheck, BenchCheckInput, ForkFinding, GameSource } from "./bench-checks.types";
import { gitBlobId } from "./copies-check";

const NAME = "no game fork";
const GAME_SOURCES = "components/neterror/resources/dino_game";
const NETERROR_ROOT = "components/neterror";
const TEXT_EXTENSIONS = [".ts", ".js", ".mjs", ".html"];
/** One shared name, such as constants.ts, can be a coincidence; this many in one change is a copied game. */
const MIN_NAME_MATCHES = 3;
/** Class definitions only the game has. Two in one file outside neterror means game code was pasted or bundled in. */
const GAME_CLASSES = [/\bclass Trex\b/, /\bclass Horizon\b/, /\bclass Obstacle\b/, /\bclass DistanceMeter\b/];

/**
 * The game in DevTools must be the error page's game, consumed through the build, so a later change to the game
 * reaches DevTools too. Fails when the change commits a copy of dino_game sources outside components/neterror:
 * a byte-identical copy, several files named like the game's sources, or a file that defines the game's classes.
 */
export async function checkNoGameFork(input: BenchCheckInput): Promise<BenchCheck> {
  const sources = await gameSources(input);
  const files = input.changedFiles
    .filter((file) => file.status !== "D" && !file.path.startsWith(`${NETERROR_ROOT}/`))
    .filter((file) => TEXT_EXTENSIONS.includes(extname(file.path).toLowerCase()))
    .map((file) => readChanged({ input, path: file.path }))
    .filter((file) => file != null);
  const findings = forkFindings({ sources, files });

  if (findings.length === 0) {
    return {
      name: NAME,
      status: "pass",
      detail: `No copy of ${GAME_SOURCES} was committed outside ${NETERROR_ROOT}.`,
    };
  }

  const listed = findings.map((finding) => `${finding.path} (${finding.why})`).join("; ");

  return {
    name: NAME,
    status: "fail",
    detail:
      `Game code was copied out of ${GAME_SOURCES}: ${listed}. A frozen copy does not pick up later changes to the ` +
      "game; DevTools has to consume the game's build output or build the same sources through build rules.",
  };
}

/** Which committed files are copies of the game's sources. Pure, so it can be tested without a checkout. */
export function forkFindings({ sources, files }: { sources: GameSource[]; files: GameSource[] }): ForkFinding[] {
  const sourceBlobs = new Map(sources.map((source) => [source.blobId, source.path]));
  const sourceNames = new Set(sources.map((source) => basename(source.path)));
  const named = files.filter((file) => sourceNames.has(basename(file.path)));
  const findings: ForkFinding[] = [];

  for (const file of files) {
    const identical = sourceBlobs.get(file.blobId);
    const classes = GAME_CLASSES.filter((pattern) => pattern.test(file.text)).length;

    if (identical != null) {
      findings.push({ path: file.path, why: `byte-identical to ${identical}` });
    } else if (named.length >= MIN_NAME_MATCHES && named.includes(file)) {
      findings.push({ path: file.path, why: `named like the game source ${basename(file.path)}` });
    } else if (classes >= 2) {
      findings.push({ path: file.path, why: `defines ${classes} of the game's classes` });
    }
  }

  return findings;
}

/** The game's TypeScript sources at the task commit, with their text and blob ids. */
async function gameSources(input: BenchCheckInput): Promise<GameSource[]> {
  const listing = await $`git ls-tree -r -z ${input.task.chromiumSha} -- ${GAME_SOURCES}`.cwd(input.chromiumSrc).text();
  const sources: GameSource[] = [];

  for (const entry of listing.split("\0")) {
    const match = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(entry);

    if (match?.[1] && match[2]) {
      sources.push({ path: match[2], blobId: match[1], text: "" });
    }
  }

  return sources;
}

function readChanged({ input, path }: { input: BenchCheckInput; path: string }): GameSource | null {
  const filePath = join(input.chromiumSrc, path);

  if (!existsSync(filePath)) {
    return null;
  }

  const bytes = readFileSync(filePath);

  return { path, blobId: gitBlobId(bytes), text: bytes.toString("utf8") };
}
