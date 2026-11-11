import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BuilderConfig } from "../../inspect/build/builder-config.types";
import { buildLogPath, startBuildJob } from "../build/build-job";
import type { BuildJob, BuildOutcome } from "../build/build-job.types";
import { runChromeCheck } from "../chrome/chrome-check";
import type { ToolArguments, ToolResult } from "../mcp/protocol.types";
import { startDinoHarness } from "../mode/dino-harness";
import { runChromeRefusal } from "../mode/policy/run-chrome-policy";
import { validateBuildPlan } from "../mode/validate-mode";
import { snapshotTree } from "../snapshot/snapshot";
import { runQueued } from "./chrome-queue";
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
  const plan = validateBuildPlan(session.context.mode);
  const started = await startBuildJob({ state: session.state, context: session.context, builder });
  const snapshot = short(started.job.snapshotSha);

  if (started.kind === "unchanged") {
    return text(
      `Nothing changed since build ${started.job.number} (snapshot ${snapshot}), which built successfully. No new build started.`,
    );
  }

  return text(
    `Build ${started.job.number} started from snapshot ${snapshot} (target ${plan.ninjaTarget}). Call wait_build to block until it is done.`,
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
    return describeOutcome({ session, job, outcome: job.outcome });
  }

  const release = holdAgent({
    runId: session.context.runId,
    logPath: buildLogPath({ logDir: session.context.logDir, buildNumber: job.number }),
  });

  try {
    const outcome = await job.done;

    return describeOutcome({ session, job, outcome });
  } finally {
    release();
  }
}

function describeOutcome({
  session,
  job,
  outcome,
}: {
  session: ToolSession;
  job: BuildJob;
  outcome: BuildOutcome;
}): ToolResult {
  const header = `Build ${job.number} (snapshot ${short(job.snapshotSha)}) ${outcome.status} after ${Math.round(outcome.durationMs / 1000)} s.`;

  if (outcome.status === "ok") {
    return text(`${header}\n${successHint({ session, outcome })}`);
  }

  if (outcome.status === "cancelled") {
    return failure(`${header} It was cancelled.`);
  }

  const where = outcome.failedStep ? `The ${outcome.failedStep} step failed` : "It failed";

  return failure(`${header} ${where}:\n${outcome.error ?? ""}\nFull log: ${outcome.logPath}`);
}

function successHint({ session, outcome }: { session: ToolSession; outcome: BuildOutcome }): string {
  const mode = session.context.mode;

  if (mode === "dino") {
    return (
      `Dino TypeScript is at ${outcome.artifactPath}. Check it with run_chrome using url "dino": that opens a ` +
      `harness that boots your rebuilt game with Chromium's sprites and sounds. Play it with key presses, ` +
      `wait_ms, screenshots, and {"state":true}; eval is off for dino tasks.`
    );
  }

  if (mode === "devtools") {
    return (
      `DevTools frontend is at ${outcome.artifactPath}. Check it with run_chrome: the stock Chromium at ` +
      `${outcome.appPath} is launched with --custom-devtools-frontend pointing at that front_end. ` +
      `Open devtools://devtools/bundled/devtools_app.html, click your panel's tab (?panel= only takes built-in ` +
      `panel ids; use a wider width if the tab is behind the overflow menu), click into the game, press keys, ` +
      `and check it with screenshots and {"state":true}; eval is off for DevTools tasks.`
    );
  }

  return (
    `Chromium is at ${outcome.appPath}. Check it with run_chrome. chrome://dino opens as an error page ` +
    `(net::ERR_INTERNET_DISCONNECTED); that is the game page, and actions run on it. {"state":true} there returns ` +
    `the game state, including playCount, which goes up on every restart.`
  );
}

/** One Chromium at a time: a call made while another runs waits for it, and is told how long it waited. */
async function runChrome({ session, args }: { session: ToolSession; args: ToolArguments }): Promise<ToolResult> {
  const queued = await runQueued({ queue: session.chromeQueue, body: () => runChromeNow({ session, args }) });
  const waitedSeconds = Math.round(queued.waitedMs / 1000);

  if (waitedSeconds < 1) {
    return queued.result;
  }

  const note = `Waited ${waitedSeconds} s for an earlier run_chrome to finish; calls run one at a time.`;

  return { ...queued.result, content: [{ type: "text", text: note }, ...queued.result.content] };
}

async function runChromeNow({ session, args }: { session: ToolSession; args: ToolArguments }): Promise<ToolResult> {
  const input = chromeInput(args);
  const built = session.state.jobs.findLast((job) => job.outcome?.status === "ok");

  if (built?.outcome?.appPath == null) {
    return failure("No successful build yet. Call start_build, then wait_build.");
  }

  const refusal = runChromeRefusal({ mode: session.context.mode, url: input.url, actions: input.actions });

  if (refusal != null) {
    return failure(refusal);
  }

  const current = await snapshotTree(session.context.chromiumSrc);
  const stale =
    current === built.snapshotSha
      ? ""
      : `\nWarning: the working tree changed since this build. Call start_build to test the newest edits.`;
  const prepared = await prepareChromeRun({ session, outcome: built.outcome, input });
  try {
    const report = await runChromeCheck({
      ...input,
      url: prepared.url,
      flags: prepared.flags,
      appPath: built.outcome.appPath,
    });
    const intro = `Running build ${built.number} (snapshot ${short(built.snapshotSha)}, mode ${session.context.mode}).${stale}`;

    return { content: [{ type: "text", text: intro }, ...report.parts] };
  } finally {
    prepared.stop?.();
  }
}

async function prepareChromeRun({
  session,
  outcome,
  input,
}: {
  session: ToolSession;
  outcome: BuildOutcome;
  input: { url: string; flags: string[] };
}): Promise<{ url: string; flags: string[]; stop?: () => void }> {
  const mode = session.context.mode;

  if (mode === "dino") {
    if (outcome.artifactPath == null || outcome.outputDir == null) {
      throw new Error("dino build is missing its TypeScript output");
    }

    const genRoot = join(outcome.outputDir, "gen");
    const litMinified = join(genRoot, "third_party/lit/v3_0/minified");
    const harness = await startDinoHarness({
      dinoTsc: outcome.artifactPath,
      chromeResources: join(genRoot, "ui/webui/resources/tsc"),
      litMinified: existsSync(litMinified) ? litMinified : null,
      chromiumSrc: session.context.chromiumSrc,
    });
    return {
      url: harness.url,
      flags: input.flags,
      stop: harness.stop,
    };
  }

  if (mode === "devtools") {
    if (outcome.artifactPath == null) {
      throw new Error("devtools build is missing its front_end output");
    }

    const flag = `--custom-devtools-frontend=file://${outcome.artifactPath}`;

    return {
      url: input.url,
      flags: input.flags.includes(flag) ? input.flags : [...input.flags, flag],
    };
  }

  return { url: input.url, flags: input.flags };
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
