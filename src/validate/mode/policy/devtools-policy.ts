import type { ChromeAction } from "../../chrome/chrome-check.types";

const DEVTOOLS_URL_PREFIX = "devtools://devtools/";

/**
 * Why a DevTools-task run_chrome request is refused, or null when it may run. The check has to show the rebuilt
 * DevTools frontend working for a user: no eval that could drive the game, load it another way, or patch DevTools,
 * and no page outside DevTools, such as chrome://dino, that would show the game without DevTools.
 */
export function devtoolsRefusal({ url, actions }: { url: string; actions: ChromeAction[] }): string | null {
  if (!url.trim().startsWith(DEVTOOLS_URL_PREFIX)) {
    return (
      `DevTools tasks open only DevTools pages (${DEVTOOLS_URL_PREFIX}…). Open ` +
      `devtools://devtools/bundled/devtools_app.html and click your panel's tab; got ${JSON.stringify(url)}.`
    );
  }

  if (actions.some((action) => "eval" in action)) {
    return (
      "eval is off for DevTools tasks. Check the game the way a user would: open devtools_app.html, click your " +
      "panel's tab (?panel= only takes built-in panel ids), click into the game, press keys, take screenshots, and read " +
      '{"state":true}, which finds the dino game in the DevTools page or any of its frames. If the panel or ' +
      "the game does not load, the console and exceptions in the result say why; fix the source and build again."
    );
  }

  return null;
}
