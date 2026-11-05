import type { KeyDefinition } from "./chrome-check.types";

const NAMED_KEYS: Record<string, KeyDefinition> = {
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  Enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
};

/** The names a `key` action accepts besides a single letter or digit. */
export const KEY_NAMES = Object.keys(NAMED_KEYS);

/** Maps `Space`, `ArrowDown`, `a`, `7`… to what Input.dispatchKeyEvent needs, or null for an unknown key. */
export function keyDefinition(name: string): KeyDefinition | null {
  const named = NAMED_KEYS[name];

  if (named) {
    return named;
  }

  if (/^[a-zA-Z]$/.test(name)) {
    const upper = name.toUpperCase();

    return { key: name, code: `Key${upper}`, keyCode: upper.charCodeAt(0), text: name };
  }

  if (/^[0-9]$/.test(name)) {
    return { key: name, code: `Digit${name}`, keyCode: name.charCodeAt(0), text: name };
  }

  return null;
}
