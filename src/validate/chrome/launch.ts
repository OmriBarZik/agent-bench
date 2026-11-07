import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withQuietSwitches } from "../../chromium-flags";
import type { ChromeCheck, DevToolsTarget, LaunchedChrome } from "./chrome-check.types";

const START_TIMEOUT_MS = 30_000;
const STDERR_LINES = 30;

/** Starts the built Chromium headless for a check, with its window size and flags. */
export async function launchChrome(check: ChromeCheck): Promise<LaunchedChrome> {
  return startChrome({
    appPath: check.appPath,
    switches: [`--window-size=${check.width},${check.height}`, ...check.flags],
    timeoutMs: START_TIMEOUT_MS,
  });
}

/** Starts the built Chromium headless with a fresh profile and a DevTools port, and finds its first page. */
export async function startChrome({
  appPath,
  switches,
  timeoutMs,
}: {
  appPath: string;
  switches: string[];
  timeoutMs: number;
}): Promise<LaunchedChrome> {
  const executable = join(appPath, "Contents/MacOS/Chromium");

  if (!existsSync(executable)) {
    throw new Error(`${executable} is missing; run start_build and wait_build first`);
  }

  const profile = mkdtempSync(join(tmpdir(), "bench-chrome-"));
  const stderrLines: string[] = [];
  const browser = Bun.spawn(
    [
      executable,
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--disable-background-networking",
      ...withQuietSwitches(switches),
      "about:blank",
    ],
    { stdin: "ignore", stdout: "ignore", stderr: "pipe" },
  );
  void keepTail({ stream: browser.stderr, lines: stderrLines });
  const stop = async () => {
    browser.kill();
    await browser.exited;
    rmSync(profile, { recursive: true, force: true });
  };

  try {
    const pageUrl = await devToolsPage({ profile, exited: browser.exited, timeoutMs });

    return { pageUrl, stop, stderrTail: () => stderrLines.join("\n") };
  } catch (error) {
    await stop();
    const tail = stderrLines.join("\n");

    throw new Error(`${error instanceof Error ? error.message : String(error)}${tail ? `\n${tail}` : ""}`);
  }
}

/**
 * Waits until Chromium has written its DevTools port and `/json/list` answers with a page.
 * The port file appears before the HTTP server accepts connections, so a refused fetch is retried.
 */
async function devToolsPage({
  profile,
  exited,
  timeoutMs,
}: {
  profile: string;
  exited: Promise<number>;
  timeoutMs: number;
}): Promise<string> {
  const file = join(profile, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  let exitCode: number | null = null;
  void exited.then((code) => {
    exitCode = code;
  });

  while (Date.now() < deadline) {
    if (exitCode != null) {
      throw new Error(`Chromium exited with code ${exitCode} before it opened DevTools`);
    }

    const port = readPort(file);

    if (port != null) {
      const page = await pageUrl(port);

      if (page) {
        return page;
      }
    }

    await Bun.sleep(200);
  }

  throw new Error(`Chromium did not open a page within ${Math.round(timeoutMs / 1000)} seconds`);
}

function readPort(file: string): number | null {
  if (!existsSync(file)) {
    return null;
  }

  const port = Number(readFileSync(file, "utf8").split("\n")[0]);

  if (port > 0) {
    return port;
  }

  return null;
}

async function pageUrl(port: number): Promise<string | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1_000) });

    if (!response.ok) {
      return null;
    }

    const targets = (await response.json()) as DevToolsTarget[];
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);

    return page?.webSocketDebuggerUrl ?? null;
  } catch {
    return null;
  }
}

async function keepTail({ stream, lines }: { stream: ReadableStream<Uint8Array>; lines: string[] }) {
  const decoder = new TextDecoder();

  for await (const chunk of stream) {
    lines.push(
      ...decoder
        .decode(chunk, { stream: true })
        .split("\n")
        .filter((line) => line.trim() !== ""),
    );
    lines.splice(0, Math.max(0, lines.length - STDERR_LINES));
  }
}
