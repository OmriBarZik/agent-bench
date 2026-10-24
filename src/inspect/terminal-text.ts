import type { LineKind } from "./terminal-text.types";

/** Pads or truncates `text` to `width` visible columns. */
export function fit({ text, width }: { text: string; width: number }): string {
  if (width <= 0) {
    return "";
  }

  if (text.length <= width) {
    return text.padEnd(width);
  }

  if (width === 1) {
    return "…";
  }

  return `${text.slice(0, width - 1)}…`;
}

/** Keeps the end of `text` when it is wider than `width`, so a long path still shows its tail. */
export function fitEnd({ text, width }: { text: string; width: number }): string {
  if (text.length <= width) {
    return text;
  }

  if (width <= 1) {
    return "…";
  }

  return `…${text.slice(text.length - (width - 1))}`;
}

/** Paints one line and clears whatever was past it. */
export function colorLine({ text, kind }: { text: string; kind: LineKind }): string {
  if (kind === "selected") {
    return `\x1b[7m${text}\x1b[0m\x1b[K`;
  }

  if (kind === "dim" || kind === "hint") {
    return `\x1b[2m${text}\x1b[0m\x1b[K`;
  }

  if (kind === "notice") {
    return `\x1b[33m${text}\x1b[0m\x1b[K`;
  }

  if (kind === "title") {
    return `\x1b[1m${text}\x1b[0m\x1b[K`;
  }

  return `${text}\x1b[K`;
}
