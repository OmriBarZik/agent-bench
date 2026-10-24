import { basename } from "node:path";
import type { Command, Word } from "unbash";

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const WRAPPERS = new Set(["sudo", "time", "nohup", "env", "command", "exec", "builtin", "nice", "stdbuf", "timeout"]);
const XARGS_WITH_VALUE = new Set([
  "-n",
  "-L",
  "-P",
  "-s",
  "-a",
  "-E",
  "-e",
  "-I",
  "-J",
  "--max-args",
  "--max-lines",
  "--max-procs",
  "--max-chars",
  "--eof",
  "--arg-file",
  "--replace",
  "--delimiter",
]);

/** Script text hidden inside this command: `bash -c`, wrappers, `find -exec`, `xargs`, and shell here-documents. */
export function nestedScripts({ command, source }: { command: Command; source: string }): string[] {
  const program = basename(command.name?.value ?? "");
  const words = command.args.filter((arg): arg is Word => arg.type === "Word");
  const scripts: string[] = [];
  const shellScript = shellDashC({ program, words });

  if (shellScript) {
    scripts.push(shellScript);
  }

  const wrapped = wrapperBody({ program, words, source });

  if (wrapped) {
    scripts.push(wrapped);
  }

  if (program === "find") {
    scripts.push(...findExec({ words, source }));
  }

  if (program === "xargs") {
    const body = xargsBody({ words, source });

    if (body) {
      scripts.push(body);
    }
  }

  if (program === "eval") {
    const code = words.map((word) => word.value).join(" ");

    if (code) {
      scripts.push(code);
    }
  }

  if (SHELLS.has(program)) {
    for (const redirect of command.redirects) {
      if (redirect.type === "HereDoc" && redirect.body.text.trim() !== "") {
        scripts.push(redirect.body.text);
      }
    }
  }

  return scripts;
}

function shellDashC({ program, words }: { program: string; words: readonly Word[] }): string | null {
  if (!SHELLS.has(program)) {
    return null;
  }

  const flagIndex = words.findIndex((word) => word.value === "-c" || /^-[a-zA-Z]*c[a-zA-Z]*$/.test(word.value));

  if (flagIndex < 0) {
    return null;
  }

  return words[flagIndex + 1]?.value ?? null;
}

function wrapperBody({
  program,
  words,
  source,
}: {
  program: string;
  words: readonly Word[];
  source: string;
}): string | null {
  if (!WRAPPERS.has(program)) {
    return null;
  }

  if (program === "command" && words.some((word) => word.value === "-v" || word.value === "-V")) {
    return null;
  }

  let index = 0;

  while (index < words.length) {
    const value = words[index]?.value ?? "";

    if (value.startsWith("-") || /^\w+=/.test(value) || /^\d+(\.\d+)?[smhd]?$/.test(value)) {
      index++;
      continue;
    }

    break;
  }

  return sourceSlice({ words: words.slice(index), source });
}

function findExec({ words, source }: { words: readonly Word[]; source: string }): string[] {
  const scripts: string[] = [];

  for (let index = 0; index < words.length; index++) {
    const flag = words[index]?.value;

    if (flag !== "-exec" && flag !== "-execdir") {
      continue;
    }

    const body: Word[] = [];
    index++;

    while (index < words.length) {
      const word = words[index];

      if (!word || word.value === ";" || word.value === "+") {
        break;
      }

      body.push(word);
      index++;
    }

    const text = sourceSlice({ words: body, source });

    if (text) {
      scripts.push(text);
    }
  }

  return scripts;
}

function xargsBody({ words, source }: { words: readonly Word[]; source: string }): string | null {
  let index = 0;

  while (index < words.length) {
    const word = words[index];

    if (!word || word.value === "--") {
      index++;
      break;
    }

    if (!word.value.startsWith("-")) {
      break;
    }

    index += XARGS_WITH_VALUE.has(word.value) ? 2 : 1;
  }

  return sourceSlice({ words: words.slice(index), source });
}

function sourceSlice({ words, source }: { words: readonly Word[]; source: string }): string | null {
  const first = words[0];
  const last = words[words.length - 1];

  if (!first || !last) {
    return null;
  }

  const text = source.slice(first.pos, last.end).trim();

  if (text === "") {
    return null;
  }

  return text;
}
