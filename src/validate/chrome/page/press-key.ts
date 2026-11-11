import type { CdpSession } from "../cdp.types";
import { keyDefinition, KEY_NAMES } from "../keys";

/** Presses a named key, holds it for `holdMs`, and releases it, as keyboard events a user would send. */
export async function pressKey({ page, name, holdMs }: { page: CdpSession; name: string; holdMs: number }) {
  const key = keyDefinition(name);

  if (key == null) {
    throw new Error(`unknown key ${name}; use a letter, a digit, or one of ${KEY_NAMES.join(", ")}`);
  }

  const event = { key: key.key, code: key.code, windowsVirtualKeyCode: key.keyCode, nativeVirtualKeyCode: key.keyCode };
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", ...event, ...(key.text ? { text: key.text } : {}) });

  if (key.text) {
    await page.send("Input.dispatchKeyEvent", { type: "char", text: key.text, key: key.key });
  }

  await Bun.sleep(Math.min(Math.max(holdMs, 0), 10_000));
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}
