import type { ChangedFile } from "../../../db/db.types";
import type { RawDiffEntry } from "./raw-diff.types";

/** Parses `git diff --raw -z` (with `--abbrev=40`) into one entry per path. */
export function parseRawDiff(raw: string): RawDiffEntry[] {
  const parts = raw.split("\0");

  if (parts.at(-1) === "") {
    parts.pop();
  }

  const entries: RawDiffEntry[] = [];
  let index = 0;

  while (index < parts.length) {
    const tokens = (parts[index] ?? "").split(" ");
    const status = tokens[4] ?? "";
    const kind = status.charAt(0);
    const entry: RawDiffEntry = {
      oldMode: (tokens[0] ?? "").replace(/^:/, ""),
      newMode: tokens[1] ?? "",
      oldSha: tokens[2] ?? "",
      newSha: tokens[3] ?? "",
      status,
      path: "",
    };

    if (kind === "R" || kind === "C") {
      entry.previousPath = parts[index + 1] ?? "";
      entry.path = parts[index + 2] ?? "";
      index += 3;
    } else {
      entry.path = parts[index + 1] ?? "";
      index += 2;
    }

    entries.push(entry);
  }

  return entries;
}

/** The name-status letter and paths stored on a run. Drops the rename score. */
export function changedFileFromEntry(entry: RawDiffEntry): ChangedFile {
  const file: ChangedFile = { status: entry.status.charAt(0), path: entry.path };

  if (entry.previousPath) {
    file.previousPath = entry.previousPath;
  }

  return file;
}
