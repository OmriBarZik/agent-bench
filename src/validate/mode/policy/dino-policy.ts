import type { ChromeAction } from "../../chrome/chrome-check.types";

const HARNESS_URLS = ["dino", "chrome://dino", "chrome://dino/"];

/** True when this run_chrome url means the dino harness. */
export function isHarnessUrl(url: string): boolean {
  return HARNESS_URLS.includes(url.trim());
}

/**
 * Why a dino-task run_chrome request is refused, or null when it may run. The harness boots the rebuilt game from
 * Chromium's own TypeScript output, sprites, and sounds, so a check may only play it: no eval that could load,
 * patch, or boot the game another way, and no other page.
 */
export function dinoRefusal({ url, actions }: { url: string; actions: ChromeAction[] }): string | null {
  if (!isHarnessUrl(url)) {
    return `Dino tasks open only the dino harness. Use url "dino"; got ${JSON.stringify(url)}.`;
  }

  if (actions.some((action) => "eval" in action)) {
    return (
      "eval is off for dino tasks. The harness already boots your rebuilt game with Chromium's own sprites, " +
      "sounds, and TypeScript output, so check it the way a player sees it: key presses, wait_ms, screenshots, " +
      'and {"state":true}, which returns whether the game is playing or crashed and the T-Rex status, position, ' +
      'jumping, and ducking. For the 2x sprites, pass flags ["--force-device-scale-factor=2"]. If the game does ' +
      "not start, the console and exceptions in the result say why; fix the game source and build again."
    );
  }

  return null;
}
