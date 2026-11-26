import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS_DIR } from "../../../paths";
import type { RunChoice } from "../../list/select-state.types";
import { readRunPatch, runDiffRange } from "../load-run-diff";
import { diffPageHtml } from "./diff-page";

/** File name of the browser diff page inside `runs/<run_id>/`. */
export const DIFF_PAGE_FILE = "diff.html";

/**
 * Writes `runs/<run_id>/diff.html` for `choice` and opens it in the default browser.
 * Returns the page's path. The page is rewritten each time, so it always matches the run's commit.
 */
export async function openDiffPage({ choice, repo }: { choice: RunChoice; repo: string }): Promise<string> {
  const range = runDiffRange(choice);
  const patch = await readRunPatch({ repo, range });
  const directory = join(RUNS_DIR, choice.runId);
  const pagePath = join(directory, DIFF_PAGE_FILE);
  mkdirSync(directory, { recursive: true });
  await Bun.write(
    pagePath,
    diffPageHtml({
      title: `${choice.taskId} × ${choice.configId} · ${choice.runId}`,
      subtitle: `${range.baseSha.slice(0, 12)}..${range.tipSha.slice(0, 12)}`,
      patch,
    }),
  );
  // Ignore stdio so the TUI keeps its alt screen while the browser opens.
  const opened = Bun.spawn(["open", pagePath], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  const exitCode = await opened.exited;

  if (exitCode !== 0) {
    throw new Error(`open exited ${exitCode} for ${pagePath}`);
  }

  return pagePath;
}
