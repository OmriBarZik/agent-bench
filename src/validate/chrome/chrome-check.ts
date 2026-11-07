import type { ContentPart } from "../mcp/protocol.types";
import { connectCdp } from "./cdp";
import type { CdpParams, CdpSession } from "./cdp.types";
import type { ChromeAction, ChromeCheck, ChromeReport } from "./chrome-check.types";
import { keyDefinition, KEY_NAMES } from "./keys";
import { launchChrome } from "./launch";

const MAX_SCREENSHOTS = 8;
const MAX_CONSOLE_LINES = 60;
const LOAD_TIMEOUT_MS = 30_000;
const STATE_EXPRESSION =
  "typeof globalThis.benchGameState === 'function' ? globalThis.benchGameState() : 'this page reports no game state'";

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

  if ("wait_ms" in action) {
    await Bun.sleep(Math.min(Math.max(action.wait_ms, 0), 30_000));

    return;
  }

  if ("eval" in action) {
    parts.push({ type: "text", text: `eval → ${await evaluate({ page, code: action.eval })}` });

    return;
  }

  if ("state" in action) {
    parts.push({ type: "text", text: `state → ${await evaluate({ page, code: STATE_EXPRESSION })}` });

    return;
  }

  if (parts.filter((part) => part.type === "image").length >= MAX_SCREENSHOTS) {
    parts.push({ type: "text", text: `screenshot skipped: at most ${MAX_SCREENSHOTS} per check` });

    return;
  }

  const shot = await page.send("Page.captureScreenshot", { format: "png" });
  parts.push({ type: "image", data: String(shot.data), mimeType: "image/png" });
}

async function pressKey({ page, name, holdMs }: { page: CdpSession; name: string; holdMs: number }) {
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

/** Statements that `return` stay a function body. An expression, including a word like `data-return`, is returned. */
export function evaluationBody(code: string): string {
  if (/(^|[^-\w])return\b/.test(code)) {
    return code;
  }

  return `return (${code});`;
}

/** Statements that `return` run inside an async function; anything else is evaluated as an expression. */
async function evaluate({ page, code }: { page: CdpSession; code: string }): Promise<string> {
  const body = evaluationBody(code);
  const result = await page.send("Runtime.evaluate", {
    expression: `(async () => { ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const exception = result.exceptionDetails as CdpParams | undefined;

  if (exception) {
    return `threw ${describeException(exception)}`;
  }

  const value = (result.result as CdpParams | undefined)?.value;

  return value === undefined ? "undefined" : truncate(JSON.stringify(value));
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

function describeException(details: CdpParams): string {
  const exception = details.exception as CdpParams | undefined;

  return String(exception?.description ?? details.text ?? "an exception");
}

function truncate(text: string): string {
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
}
