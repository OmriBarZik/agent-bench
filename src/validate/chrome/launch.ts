import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChromeCheck, DevToolsTarget, LaunchedChrome } from "./chrome-check.types";

const START_TIMEOUT_MS = 30_000;
const STDERR_LINES = 30;

/** Starts the built Chromium headless with a fresh profile and a DevTools port, and finds its first page. */
export async function launchChrome(check: ChromeCheck): Promise<LaunchedChrome> {
  const executable = join(check.appPath, "Contents/MacOS/Chromium");

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
      `--window-size=${check.width},${check.height}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      ...check.flags,
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
    const port = await devToolsPort({ profile, exited: browser.exited });
    const pageUrl = await firstPage(port);

    return { pageUrl, stop, stderrTail: () => stderrLines.join("\n") };
  } catch (error) {
    await stop();
    const tail = stderrLines.join("\n");

    throw new Error(`${error instanceof Error ? error.message : String(error)}${tail ? `\n${tail}` : ""}`);
  }
}

/** Chromium writes the port it picked to DevToolsActivePort in the profile. */
async function devToolsPort({ profile, exited }: { profile: string; exited: Promise<number> }): Promise<number> {
  const file = join(profile, "DevToolsActivePort");
  const deadline = Date.now() + START_TIMEOUT_MS;
  let exitCode: number | null = null;
  void exited.then((code) => {
    exitCode = code;
  });

  while (Date.now() < deadline) {
    if (exitCode != null) {
      throw new Error(`Chromium exited with code ${exitCode} before it opened DevTools`);
    }

    if (existsSync(file)) {
      const port = Number(readFileSync(file, "utf8").split("\n")[0]);

      if (port > 0) {
        return port;
      }
    }

    await Bun.sleep(200);
  }

  throw new Error("Chromium did not open its DevTools port within 30 seconds");
}

async function firstPage(port: number): Promise<string> {
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as DevToolsTarget[];
  const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);

  if (!page?.webSocketDebuggerUrl) {
    throw new Error("Chromium started without a page to drive");
  }

  return page.webSocketDebuggerUrl;
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
