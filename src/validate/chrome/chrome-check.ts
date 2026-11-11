import type { ContentPart } from "../mcp/protocol.types";
import { connectCdp } from "./cdp";
import type { CdpParams, CdpSession } from "./cdp.types";
import type { ChromeAction, ChromeCheck, ChromeReport } from "./chrome-check.types";
import { launchChrome } from "./launch";
import { clickAt } from "./page/click";
import { describeException, evaluate, truncate } from "./page/evaluate";
import { readGameState } from "./page/game-state";
import { pressKey } from "./page/press-key";

const MAX_SCREENSHOTS = 8;
const MAX_CONSOLE_LINES = 60;
const LOAD_TIMEOUT_MS = 30_000;
/** One wait action's longest pause. A longer wait_ms is cut to this and the agent is told so. */
const MAX_WAIT_MS = 30_000;

/**
 * Opens `url` in a fresh headless Chromium from the build, runs the actions in order, and returns what happened:
 * eval results, console messages, page exceptions, and screenshots. Chromium is always stopped afterwards.
 */
export async function runChromeCheck(check: ChromeCheck): Promise<ChromeReport> {
  const chrome = await launchChrome(check);
  const parts: ContentPart[] = [];
  const consoleLines: string[] = [];
  let page: CdpSession | null = null;

  try {
    page = await connectCdp(chrome.pageUrl);
    listenToConsole({ page, consoleLines });
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await navigate({ page, url: check.url, parts });

    for (const action of check.actions) {
      await runAction({ page, action, parts });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    parts.push({ type: "text", text: `check stopped: ${message}\n${chrome.stderrTail()}`.trim() });
  } finally {
    page?.close();
    await chrome.stop();
  }

  if (consoleLines.length > 0) {
    parts.push({ type: "text", text: `console and exceptions:\n${consoleLines.join("\n")}` });
  }

  return { parts };
}

async function navigate({ page, url, parts }: { page: CdpSession; url: string; parts: ContentPart[] }) {
  const loaded = new Promise<void>((resolve) => {
    page.on("Page.loadEventFired", () => resolve());
    setTimeout(resolve, LOAD_TIMEOUT_MS);
  });
  const result = await page.send("Page.navigate", { url });
  await loaded;

  // chrome://dino is Chromium's network-error page, so it always reports an error such as
  // net::ERR_INTERNET_DISCONNECTED while the game page loads fine. The actions still run on the error page.
  if (typeof result.errorText === "string") {
    parts.push({ type: "text", text: `opened ${url} as an error page (${result.errorText})` });

    return;
  }

  parts.push({ type: "text", text: `opened ${url}` });
}

async function runAction({ page, action, parts }: { page: CdpSession; action: ChromeAction; parts: ContentPart[] }) {
  if ("key" in action) {
    await pressKey({ page, name: action.key, holdMs: action.hold_ms ?? 50 });

    return;
  }

  if ("click" in action) {
    await clickAt({ page, point: action.click });

    return;
  }

  if ("wait_ms" in action) {
    await waitFor({ waitMs: action.wait_ms, parts });

    return;
  }

  if ("eval" in action) {
    parts.push({ type: "text", text: `eval → ${await evaluate({ page, code: action.eval })}` });

    return;
  }

  if ("state" in action) {
    parts.push({ type: "text", text: `state → ${await readGameState(page)}` });

    return;
  }

  if (parts.filter((part) => part.type === "image").length >= MAX_SCREENSHOTS) {
    parts.push({ type: "text", text: `screenshot skipped: at most ${MAX_SCREENSHOTS} per check` });

    return;
  }

  const shot = await page.send("Page.captureScreenshot", { format: "png" });
  parts.push({ type: "image", data: String(shot.data), mimeType: "image/png" });
}

/** Waits, and says so when the wait was cut to MAX_WAIT_MS, so the agent never assumes a longer run. */
async function waitFor({ waitMs, parts }: { waitMs: number; parts: ContentPart[] }) {
  const waited = Math.min(Math.max(waitMs, 0), MAX_WAIT_MS);
  await Bun.sleep(waited);

  if (waited < waitMs) {
    parts.push({
      type: "text",
      text: `waited ${waited} ms, not ${waitMs}: one wait_ms is at most ${MAX_WAIT_MS}; add more waits for longer`,
    });
  }
}

function listenToConsole({ page, consoleLines }: { page: CdpSession; consoleLines: string[] }) {
  const add = (line: string) => {
    if (consoleLines.length < MAX_CONSOLE_LINES) {
      consoleLines.push(truncate(line));
    }
  };
  page.on("Runtime.consoleAPICalled", (params) => {
    const args = (params.args as CdpParams[] | undefined) ?? [];
    add(`[${String(params.type)}] ${args.map((arg) => String(arg.value ?? arg.description ?? "")).join(" ")}`);
  });
  page.on("Runtime.exceptionThrown", (params) => {
    add(`[exception] ${describeException(params.exceptionDetails as CdpParams)}`);
  });
}
