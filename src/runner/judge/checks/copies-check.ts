import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { BenchCheck, BenchCheckInput } from "./bench-checks.types";

const GAME_ROOT = "components/neterror/resources";
const ASSET_EXTENSIONS = [".png", ".mp3", ".wav", ".ogg", ".webp", ".gif", ".svg"];
const SOURCE_EXTENSIONS = [".ts", ".js", ".html", ".css"];
const REQUIRED_ASSETS = [/100-offline-sprite\.png$/, /200-offline-sprite\.png$/, /sounds\/[^/]+\.mp3$/];

/** Git's blob id for `bytes`: equal ids mean byte-identical files. */
export function gitBlobId(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha1");
  hasher.update(`blob ${bytes.byteLength}\0`);
  hasher.update(bytes);

  return hasher.digest("hex");
}

/**
 * Every image or sound the agent added or changed outside the game must be byte-identical to an original under
 * components/neterror/resources at the task commit. A changed original asset is a fail too.
 */
export async function checkAssetCopies(input: BenchCheckInput): Promise<BenchCheck> {
  const originals = await originalBlobs(input);
  const touched = input.changedFiles.filter((file) => file.status !== "D" && hasExtension(file.path, ASSET_EXTENSIONS));
  const editedOriginals = touched.filter((file) => file.path.startsWith(`${GAME_ROOT}/`));
  const copies = touched.filter((file) => !file.path.startsWith(`${GAME_ROOT}/`));
  const matched = new Map<string, string>();
  const unmatched: string[] = [];

  for (const copy of copies) {
    const original = originals.get(diskBlobId({ input, path: copy.path }) ?? "");

    if (original == null) {
      unmatched.push(copy.path);
    } else {
      matched.set(copy.path, original);
    }
  }

  const problems = [
    ...editedOriginals.map((file) => `the original ${file.path} was changed`),
    ...unmatched.map((path) => `${path} is not byte-identical to any image or sound in ${GAME_ROOT}`),
  ];

  if (problems.length > 0) {
    return { name: "asset copies", status: "fail", detail: `${problems.join("; ")}.` };
  }

  const covered = [...matched.values()];
  const missing = REQUIRED_ASSETS.filter((pattern) => !covered.some((path) => pattern.test(path)));
  const listed = [...matched].map(([copy, original]) => `${copy} = ${original}`).join("; ");

  if (copies.length === 0 || missing.length > 0) {
    return {
      name: "asset copies",
      status: "review",
      detail:
        `${copies.length === 0 ? "No image or sound files were added to the tree." : `Byte-identical copies: ${listed}.`} ` +
        "Not every original sprite sheet (1x and 2x) and sound has a committed copy, so check in BUILD.gn and the " +
        "grd lists that the build copies the rest from the originals.",
    };
  }

  return { name: "asset copies", status: "pass", detail: `Every added image and sound is an original: ${listed}.` };
}

/**
 * Lists edits to the game's own sources, and added files that share a name with a game source but differ from it.
 * Both may be what loading the game needs, so the judge reviews them in the code.
 */
export async function checkGameSources(input: BenchCheckInput): Promise<BenchCheck> {
  const originals = await originalBlobs(input);
  const names = new Map([...originals.values()].map((path) => [basename(path), path]));
  const isSource = (path: string) => hasExtension(path, SOURCE_EXTENSIONS);
  const edited = input.changedFiles.filter((file) => file.path.startsWith(`${GAME_ROOT}/`) && isSource(file.path));
  const altered = input.changedFiles.filter((file) => {
    const original = names.get(basename(file.path));

    return (
      file.status !== "D" &&
      !file.path.startsWith(`${GAME_ROOT}/`) &&
      // Names like constants.ts are common, so only files in a dino folder count as copies of the game.
      /dino/i.test(file.path) &&
      isSource(file.path) &&
      original != null &&
      originals.get(diskBlobId({ input, path: file.path }) ?? "") == null
    );
  });

  if (edited.length === 0 && altered.length === 0) {
    return {
      name: "game sources",
      status: "pass",
      detail: `No file under ${GAME_ROOT} was changed or copied with edits.`,
    };
  }

  const parts = [
    edited.length > 0 ? `changed game files: ${edited.map((file) => `${file.status} ${file.path}`).join(", ")}` : "",
    altered.length > 0
      ? `files named like a game source but not identical to it: ${altered.map((file) => file.path).join(", ")}`
      : "",
  ].filter((part) => part !== "");

  return {
    name: "game sources",
    status: "review",
    detail: `${parts.join("; ")}. Check that these are only what loading the game needs, not rewritten game logic.`,
  };
}

/** Blob id → path for every file under the game folder at the task commit. */
async function originalBlobs(input: BenchCheckInput): Promise<Map<string, string>> {
  const listing = await $`git ls-tree -r -z ${input.task.chromiumSha} -- ${GAME_ROOT}`.cwd(input.chromiumSrc).text();
  const blobs = new Map<string, string>();

  for (const entry of listing.split("\0")) {
    const match = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(entry);

    if (match?.[1] && match[2]) {
      blobs.set(match[1], match[2]);
    }
  }

  return blobs;
}

function diskBlobId({ input, path }: { input: BenchCheckInput; path: string }): string | null {
  const filePath = join(input.chromiumSrc, path);

  return existsSync(filePath) ? gitBlobId(readFileSync(filePath)) : null;
}

function hasExtension(path: string, extensions: string[]): boolean {
  return extensions.includes(extname(path).toLowerCase());
}
