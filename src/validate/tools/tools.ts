import type { BuilderConfig } from "../../inspect/build/builder-config.types";
import { buildLogPath, startBuildJob } from "../build/build-job";
import type { BuildJob, BuildOutcome } from "../build/build-job.types";
import { runChromeCheck } from "../chrome/chrome-check";
import type { ToolArguments, ToolResult } from "../mcp/protocol.types";
import { snapshotTree } from "../snapshot/snapshot";
import { holdAgent } from "./hold-agent";
import { chromeInput, waitInput } from "./tool-input";
import type { ToolSession } from "./tools.types";

/** Runs one chrome-validate tool. Every failure becomes an `isError` result the agent can read; this never throws. */
export async function callTool({
  session,
  name,
  args,
}: {
  session: ToolSession;
  name: string;
  args: ToolArguments;
}): Promise<ToolResult> {
  try {
    const builder = session.context.builder;

    if (builder == null) {
      return failure(
        "The build Mac is not set up (configs/builder/remote.yaml is missing), so builds are unavailable.",
      );
    }

    if (name === "start_build") {
      return await startBuild({ session, builder });
    }

    if (name === "wait_build") {
      return await waitBuild({ session, args });
    }

    if (name === "run_chrome") {
      return await runChrome({ session, args });
    }

    return failure(`unknown tool ${name}`);
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

async function startBuild({ session, builder }: { session: ToolSession; builder: BuilderConfig }): Promise<ToolResult> {
  const started = await startBuildJob({ state: session.state, context: session.context, builder });
  const snapshot = short(started.job.snapshotSha);

  if (started.kind === "unchanged") {
    return text(
      `Nothing changed since build ${started.job.number} (snapshot ${snapshot}), which built successfully. No new build started.`,
    );
  }

  return text(
    `Build ${started.job.number} started from snapshot ${snapshot}. Call wait_build to block until it is done.`,
  );
}

async function waitBuild({ session, args }: { session: ToolSession; args: ToolArguments }): Promise<ToolResult> {
  const input = waitInput(args);
  const job =
    input.build == null ? session.state.jobs.at(-1) : session.state.jobs.find((entry) => entry.number === input.build);

  if (job == null) {
    return failure(
      input.build == null ? "No build has been started; call start_build first." : `There is no build ${input.build}.`,
    );
  }

  if (job.outcome != null) {
    return describeOutcome({ job, outcome: job.outcome });
  }

  const release = holdAgent({
    runId: session.context.runId,
    logPath: buildLogPath({ logDir: session.context.logDir, buildNumber: job.number }),
  });

  try {
    const outcome = await job.done;

    return describeOutcome({ job, outcome });
  } finally {
    release();
  }
}

function describeOutcome({ job, outcome }: { job: BuildJob; outcome: BuildOutcome }): ToolResult {
  const header = `Build ${job.number} (snapshot ${short(job.snapshotSha)}) ${outcome.status} after ${Math.round(outcome.durationMs / 1000)} s.`;

  if (outcome.status === "ok") {
    return text(`${header}\nChromium is at ${outcome.appPath}. Check it with run_chrome.`);
  }

  if (outcome.status === "cancelled") {
    return failure(`${header} It was cancelled.`);
  }

  const where = outcome.failedStep ? `The ${outcome.failedStep} step failed` : "It failed";

  return failure(`${header} ${where}:\n${outcome.error ?? ""}\nFull log: ${outcome.logPath}`);
}

async function runChrome({ session, args }: { session: ToolSession; args: ToolArguments }): Promise<ToolResult> {
  const input = chromeInput(args);
  const built = session.state.jobs.findLast((job) => job.outcome?.status === "ok");

  if (built?.outcome?.appPath == null) {
    return failure("No successful build yet. Call start_build, then wait_build.");
  }

  const current = await snapshotTree(session.context.chromiumSrc);
  const stale =
    current === built.snapshotSha
      ? ""
      : `\nWarning: the working tree changed since this build. Call start_build to test the newest edits.`;
  const report = await runChromeCheck({ ...input, appPath: built.outcome.appPath });
  const intro = `Running build ${built.number} (snapshot ${short(built.snapshotSha)}).${stale}`;

  return { content: [{ type: "text", text: intro }, ...report.parts] };
}

function text(message: string): ToolResult {
  return { content: [{ type: "text", text: message }] };
}

function failure(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function short(sha: string): string {
  return sha.slice(0, 12);
}
