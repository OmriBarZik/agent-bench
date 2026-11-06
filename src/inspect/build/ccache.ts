import { existsSync } from "node:fs";
import { join } from "node:path";

/** Homebrew prefixes. A non-interactive ssh session does not load path_helper, so these are missing there. */
const CCACHE_DIRECTORIES = ["/opt/homebrew/bin", "/usr/local/bin"];

/** ccache's default is 5 GiB, which is smaller than one Chrome component build. docs/ccache_mac.md says to raise it with `ccache -M`. */
const CCACHE_MAX_SIZE = "50GiB";
const CCACHE_FLOOR_BYTES = 50 * 1024 * 1024 * 1024;

const SIZE_AWK = `
{
  text = $0
  if (match(text, /[0-9]+([.][0-9]+)?/)) {
    number = substr(text, RSTART, RLENGTH) + 0
  } else {
    number = 0
  }
  multiplier = 1
  if (text ~ /TiB/) {
    multiplier = 1024 * 1024 * 1024 * 1024
  } else if (text ~ /GiB/) {
    multiplier = 1024 * 1024 * 1024
  } else if (text ~ /MiB/) {
    multiplier = 1024 * 1024
  } else if (text ~ /KiB/) {
    multiplier = 1024
  } else if (text ~ /TB/) {
    multiplier = 1000 * 1000 * 1000 * 1000
  } else if (text ~ /GB/) {
    multiplier = 1000 * 1000 * 1000
  } else if (text ~ /MB/) {
    multiplier = 1000 * 1000
  } else if (text ~ /kB/) {
    multiplier = 1000
  } else {
    multiplier = 1024 * 1024 * 1024
  }
  printf "%.0f", number * multiplier
}
`.trim();

/**
 * Puts a Homebrew directory on `path` when `ccache` is not already on it.
 * Leaves `path` unchanged when ccache is present, or when neither Homebrew prefix has it.
 */
export function extendPathForCcache(path: string): string {
  const directories = path.split(":").filter((directory) => directory !== "");

  for (const directory of directories) {
    if (existsSync(join(directory, "ccache"))) {
      return path;
    }
  }

  for (const directory of CCACHE_DIRECTORIES) {
    if (existsSync(join(directory, "ccache"))) {
      return [...directories, directory].join(":");
    }
  }

  return path;
}

/**
 * Fails when ccache is missing, and raises its ceiling to 50 GiB when the current one is lower.
 * The compiler wrapper in configs/builder/args.gn sets the sloppiness ccache needs for this tree.
 */
export function prepareCcacheScript(): string {
  return `set -eu
set -o pipefail
if ! command -v ccache >/dev/null 2>&1; then
  PATH="$PATH:${CCACHE_DIRECTORIES.join(":")}"
  export PATH
fi
if ! command -v ccache >/dev/null 2>&1; then
  printf '%s\\n' "ccache is not on PATH. Install it with: brew install ccache" >&2
  exit 1
fi
current_size=$(ccache --get-config max_size)
current_bytes=$(printf '%s\\n' "$current_size" | awk '${SIZE_AWK}')
if [ -z "$current_bytes" ]; then
  current_bytes=0
fi
if [ "$current_bytes" -lt ${CCACHE_FLOOR_BYTES} ]; then
  ccache --set-config max_size=${CCACHE_MAX_SIZE}
fi
`;
}
