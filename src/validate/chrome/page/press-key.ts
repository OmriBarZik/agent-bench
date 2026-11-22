import type { CdpSession } from "../cdp.types";
import type { KeyDefinition } from "../chrome-check.types";
import { keyDefinition, KEY_NAMES } from "../keys";

/** Presses a named key, holds it for `holdMs`, and releases it, as keyboard events a user would send. */
export async function pressKey({ page, name, holdMs }: { page: CdpSession; name: string; holdMs: number }) {
  await keyDown({ page, name });
  await Bun.sleep(Math.min(Math.max(holdMs, 0), 10_000));
  await keyUp({ page, name });
}

/** Presses a named key and leaves it down, so later actions (screenshots, state) see it held. */
export async function keyDown({ page, name }: { page: CdpSession; name: string }) {
  const key = namedKey(name);
  await page.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    ...keyEvent(key),
    ...(key.text ? { text: key.text } : {}),
  });

  if (key.text) {
    await page.send("Input.dispatchKeyEvent", { type: "char", text: key.text, key: key.key });
  }
}

/** Releases a named key pressed with keyDown. */
export async function keyUp({ page, name }: { page: CdpSession; name: string }) {
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent(namedKey(name)) });
}

function namedKey(name: string): KeyDefinition {
  const key = keyDefinition(name);

  if (key == null) {
    throw new Error(`unknown key ${name}; use a letter, a digit, or one of ${KEY_NAMES.join(", ")}`);
  }

  return key;
}

function keyEvent(key: KeyDefinition) {
  return { key: key.key, code: key.code, windowsVirtualKeyCode: key.keyCode, nativeVirtualKeyCode: key.keyCode };
}
