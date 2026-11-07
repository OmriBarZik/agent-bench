import { appendFileSync } from "node:fs";
import { startChrome } from "./launch";

/** A fresh build's first launch measured ~2 minutes; later launches take about 2 seconds. */
const WARM_UP_TIMEOUT_MS = 5 * 60_000;

/**
 * Launches a freshly copied Chromium.app once and stops it, logging how long that took.
 * macOS checks every new dylib of the component build on its first launch, which takes minutes and would
 * otherwise time out the agent's first run_chrome calls. Never throws: a failed warm-up leaves run_chrome to report.
 */
export async function warmUpChrome({ appPath, logPath }: { appPath: string; logPath: string }) {
  const startedAt = Date.now();
  appendFileSync(logPath, `\n$ first launch of ${appPath}\n`);

  try {
    const chrome = await startChrome({ appPath, switches: [], timeoutMs: WARM_UP_TIMEOUT_MS });
    await chrome.stop();
    appendFileSync(logPath, `Chromium opened a page after ${seconds(startedAt)}s\n`);
  } catch (error) {
    // The build itself succeeded, so a warm-up failure is only logged.
    const message = error instanceof Error ? error.message : String(error);
    appendFileSync(logPath, `warm-up failed after ${seconds(startedAt)}s: ${message}\n`);
  }
}

function seconds(startedAt: number): number {
  return Math.round((Date.now() - startedAt) / 1000);
}
