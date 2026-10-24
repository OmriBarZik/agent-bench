import { basename } from "node:path";
import type { Command, CommandArgument } from "unbash";
import { DIRECTORY_DENIAL, FILE_DENIAL } from "../src/baseline-policy";

const DIRECTORY_COMMANDS = new Set(["cd", "pushd", "popd"]);
const EDITORS = new Set(["ed", "ex", "vi", "vim", "nvim", "nano", "emacs", "pico"]);
const INTERPRETERS = new Set(["python", "python3", "node", "nodejs", "ruby", "perl", "bun"]);
const GIT_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
const DISCARD_TARGETS = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty", "/dev/fd/1", "/dev/fd/2"]);
const OUTPUT_OPERATORS = new Set([">", ">>", ">|", "&>", "&>>"]);

const DIRECTORY_CALL = /\bos\.chdir\s*\(|\bprocess\.chdir\s*\(/;
const FILE_WRITE = [
  /\bopen\s*\([\s\S]{0,200}?(?:,\s*|mode\s*=\s*)['"](?:wb|ab|xb|w\+|a\+|r\+|w|a|x)['"]/,
  /\.write_text\s*\(/,
  /\.write_bytes\s*\(/,
  /\bwriteFile(?:Sync)?\s*\(/,
  /\bappendFile(?:Sync)?\s*\(/,
  /\bcopyFile(?:Sync)?\s*\(/,
];

/** Directory change or shell file edit in this one command. Nested scripts are handled by the caller. */
export function commandDenial(command: Command): string | null {
  if (changesDirectory(command)) {
    return DIRECTORY_DENIAL;
  }

  if (writesFile(command)) {
    return FILE_DENIAL;
  }

  return null;
}

function changesDirectory(command: Command): boolean {
  const program = programName(command);

  if (program && DIRECTORY_COMMANDS.has(program)) {
    return true;
  }

  if (program && INTERPRETERS.has(program) && isInline(command) && DIRECTORY_CALL.test(inlineText(command))) {
    return true;
  }

  return false;
}

function writesFile(command: Command): boolean {
  if (redirectWrites(command)) {
    return true;
  }

  const program = programName(command);

  if (!program) {
    return false;
  }

  if (EDITORS.has(program) || program === "patch" || program === "sponge") {
    return true;
  }

  const args = wordValues(command.args);

  if (program === "tee") {
    return teeWrites(args);
  }

  if (program === "sed") {
    return args.some((word) => word === "--in-place" || word.startsWith("--in-place=") || /^-[A-Za-z]*i/.test(word));
  }

  if (program === "perl" || program === "ruby") {
    return args.some((word) => /^-([0-9A-Za-z]*i|i)/.test(word) || word.startsWith("-i"));
  }

  if ((program === "awk" || program === "gawk") && awkInPlace(args)) {
    return true;
  }

  if (program === "dd" && args.some((word) => word.startsWith("of=") && !DISCARD_TARGETS.has(word.slice(3)))) {
    return true;
  }

  if (program === "git" && gitWritesWorktree(args)) {
    return true;
  }

  if (
    INTERPRETERS.has(program) &&
    isInline(command) &&
    FILE_WRITE.some((pattern) => pattern.test(inlineText(command)))
  ) {
    return true;
  }

  return false;
}

function redirectWrites(command: Command): boolean {
  for (const redirect of command.redirects) {
    if (redirect.type !== "Redirect") {
      continue;
    }

    const target = redirect.target?.value;

    if (!target || DISCARD_TARGETS.has(target)) {
      continue;
    }

    if (redirect.operator === ">&" && (/^\d+$/.test(target) || target === "-")) {
      continue;
    }

    if (OUTPUT_OPERATORS.has(redirect.operator) || redirect.operator === ">&") {
      return true;
    }
  }

  return false;
}

function programName(command: Command): string | null {
  const value = command.name?.value;

  if (!value) {
    return null;
  }

  return basename(value);
}

function isInline(command: Command): boolean {
  if (command.redirects.some((redirect) => redirect.type === "HereDoc")) {
    return true;
  }

  return wordValues([command.name, ...command.args]).some(
    (word) => word === "-" || word === "-c" || word === "-e" || word === "--eval" || word.startsWith("--eval="),
  );
}

function inlineText(command: Command): string {
  const words = wordValues([command.name, ...command.args]);
  const bodies = command.redirects.flatMap((redirect) => (redirect.type === "HereDoc" ? [redirect.body.text] : []));

  return [...words, ...bodies].join("\n");
}

function wordValues(args: readonly (CommandArgument | undefined)[]): string[] {
  return args.flatMap((arg) => (arg?.type === "Word" ? [arg.value] : []));
}

function teeWrites(words: readonly string[]): boolean {
  let operands = false;

  for (const word of words) {
    if (word === "--") {
      operands = true;
      continue;
    }

    if (!operands && word.startsWith("-")) {
      continue;
    }

    if (!DISCARD_TARGETS.has(word)) {
      return true;
    }
  }

  return false;
}

function awkInPlace(words: readonly string[]): boolean {
  return words.some((word, index) => (word === "-i" && words[index + 1] === "inplace") || word === "--inplace");
}

function gitWritesWorktree(words: readonly string[]): boolean {
  const subcommand = gitSubcommand(words);

  return subcommand === "apply" || subcommand === "am" || subcommand === "restore";
}

function gitSubcommand(words: readonly string[]): string | null {
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
