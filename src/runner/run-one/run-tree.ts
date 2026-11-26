import type { ClaudeResult, TaskInputFile } from "../../db/db.types";
import { CHROMIUM_SRC } from "../../paths";
import { copyTranscript } from "../claude/claude";
import { commitRunChanges, createRunBranch, resetChromium, restoreCommittedTree } from "../chromium/chromium";
import { BenchmarkShutdown } from "../shutdown/shutdown";
import type { CommittedWork } from "./run-tree.types";
import { copyTaskInputs } from "./task-inputs";

/**
 * Resets Chromium, creates the run branch, and copies in the task's supplied files.
 * Ctrl+C here, before the runs row exists, stops the benchmark with nothing to update.
 */
export async function prepareCheckout({
  sha,
  sync,
  runId,
  inputFiles = [],
  signal,
}: {
  sha: string;
  sync: boolean;
  runId: string;
  inputFiles?: TaskInputFile[];
  signal: AbortSignal;
}) {
  try {
    await resetChromium({ sha, sync });

    if (signal.aborted) {
      throw new BenchmarkShutdown();
    }

    await createRunBranch(runId);
    await copyTaskInputs({ inputFiles, chromiumSrc: CHROMIUM_SRC });
  } catch (error) {
    if (signal.aborted) {
      throw new BenchmarkShutdown();
    }

    throw error;
  }
}

/** Commits the checkout. A git failure is returned with the session result so the run row can still be closed. */
export async function commitAgentWork({
  runId,
  baseSha,
  result,
}: {
  runId: string;
  baseSha: string;
  result: ClaudeResult;
}): Promise<CommittedWork> {
  try {
    const artifact = await commitRunChanges({
      branch: runId,
      baseSha,
      message: `agent-bench ${runId}`,
    });

    return { result, artifact, commitError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      result: { ...result, commitError: message },
      artifact: { commitSha: null, changedFiles: [] },
      commitError: error,
    };
  }
}

/** Drops edits made after the run commit. A Ctrl+C during the reset is a warning, not a lost run row. */
export async function restoreTree({ signal, commitSha }: { signal: AbortSignal; commitSha: string | null }) {
  if (!commitSha) {
    return;
  }

  try {
    await restoreCommittedTree();
  } catch (error) {
    if (!signal.aborted) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  checkout was not restored: ${message}`);
  }
}

/** Copies the session log. A missing or unreadable log must not skip closing the run. */
export function saveTranscript({ sessionId, outDir }: { sessionId: string; outDir: string }) {
  try {
    if (!copyTranscript({ sessionId, destDir: outDir })) {
      console.warn(`  transcript for session ${sessionId} not found`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  transcript for session ${sessionId} was not copied: ${message}`);
  }
}
