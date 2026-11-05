const GIT_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);

/** The git subcommand in these arguments (everything after `git`), skipping global options such as `-C <path>`. */
export function gitSubcommand(words: readonly string[]): string | null {
  let index = 0;

  while (index < words.length) {
    const word = words[index] ?? "";

    if (GIT_OPTIONS_WITH_VALUE.has(word)) {
      index += 2;
      continue;
    }

    if (word.startsWith("-")) {
      index++;
      continue;
    }

    return word;
  }

  return null;
}
