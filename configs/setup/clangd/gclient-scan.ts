import type { CloseBracket, OpenBracket, SourceSpan } from "./gclient-clangd.types";

/** Leading spaces or tabs on the line that contains `index`. */
export function lineIndent({ source, index }: { source: string; index: number }): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const indent = /^[ \t]*/.exec(source.slice(lineStart));

  return indent?.[0] ?? "";
}

/** The `{ ... }` solution whose name is `src`, or null when the file has none. */
export function srcSolutionSpan(source: string): SourceSpan | null {
  const list = /solutions\s*=\s*\[/.exec(source);

  if (list == null) {
    return null;
  }

  let index = list.index + list[0].length;

  while (index < source.length) {
    index = skipTrivia(source, index);
    const character = source[index];

    if (character === "]" || character == null) {
      return null;
    }

    if (character !== "{") {
      index += 1;

      continue;
    }

    const end = matchingClose({ source, openIndex: index, open: "{", close: "}" });
    const body = source.slice(index, end);

    if (/"name"\s*:\s*"src"|'name'\s*:\s*'src'/.test(body)) {
      return { start: index, end };
    }

    index = end;
  }

  return null;
}

/** Index just after the bracket that closes the one at `openIndex`. */
export function matchingClose({
  source,
  openIndex,
  open,
  close,
}: {
  source: string;
  openIndex: number;
  open: OpenBracket;
  close: CloseBracket;
}): number {
  let depth = 0;

  for (let index = openIndex; index < source.length; index++) {
    const character = source[index];

    if (character === '"' || character === "'") {
      index = endOfString({ source, quoteIndex: index });

      continue;
    }

    if (character === "#") {
      const newline = source.indexOf("\n", index);
      index = newline === -1 ? source.length : newline;

      continue;
    }

    if (character === open) {
      depth += 1;

      continue;
    }

    if (character === close) {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error(".gclient has an unclosed bracket.");
}

function skipTrivia(source: string, index: number): number {
  let cursor = index;

  while (cursor < source.length) {
    const character = source[cursor];

    if (character != null && /\s/.test(character)) {
      cursor += 1;

      continue;
    }

    if (character === "#") {
      const newline = source.indexOf("\n", cursor);
      cursor = newline === -1 ? source.length : newline + 1;

      continue;
    }

    return cursor;
  }

  return cursor;
}

function endOfString({ source, quoteIndex }: { source: string; quoteIndex: number }): number {
  const quote = source[quoteIndex];

  for (let index = quoteIndex + 1; index < source.length; index++) {
    if (source[index] === "\\") {
      index += 1;

      continue;
    }

    if (source[index] === quote) {
      return index;
    }
  }

  throw new Error(".gclient has an unclosed string.");
}
