import type { RunRecord } from "../run-records.types";
import type { CompactRun } from "./compact-run.types";

/** Characters of the agent's closing message kept in the bundle. */
const AGENT_SUMMARY_CHARS = 600;
/** Tools listed per run in the bundle, most used first. */
const TOP_TOOLS = 12;

/** Drops the bulky parts of a run (commands, compiler errors, long messages) so the bundle fits in a chat. */
export function compactRun(run: RunRecord): CompactRun {
  const validation = run.phases.find((phase) => phase.phase === "validation");
  const phaseTokens = run.phases.reduce((sum, phase) => sum + (phase.totalTokens ?? 0), 0);

  return {
    runId: run.runId,
    taskId: run.taskId,
    configId: run.configId,
    repeat: run.repeat,
    promptVersion: run.promptVersion,
    status: run.agent.status,
    timeline: run.timeline,
    model: run.agent.model,
    minutes: run.agent.durationMs == null ? null : Math.round(run.agent.durationMs / 6000) / 10,
    turns: run.agent.numTurns,
    costUsd: run.agent.costUsd == null ? null : Math.round(run.agent.costUsd * 100) / 100,
    totalTokens: run.agent.totalTokens,
    validationShare: phaseTokens === 0 ? null : Math.round(((validation?.totalTokens ?? 0) / phaseTokens) * 100) / 100,
    decision: run.judge.decision,
    success: run.judge.success,
    judgeReason: run.judge.reason,
    blockers: run.judge.blockers,
    benchChecks: run.benchChecks?.map((check) => `${check.name}: ${check.status}`) ?? null,
    changedFiles: Array.isArray(run.changedFiles) ? run.changedFiles.length : 0,
    builds: {
      count: run.builds.length,
      statuses: run.builds.map((build) => build.status),
      failedSteps: run.builds.flatMap((build) => (build.failedStep ? [build.failedStep] : [])),
    },
    tools: {
      top: run.toolUsage.slice(0, TOP_TOOLS).map((usage) => `${usage.program ?? usage.tool} ×${usage.calls}`),
      notRan: run.toolUsage.reduce((sum, usage) => sum + usage.notRan, 0),
      failed: run.toolUsage.reduce((sum, usage) => sum + usage.failed, 0),
    },
    agentSummary: run.agent.finalMessage?.slice(0, AGENT_SUMMARY_CHARS) ?? null,
  };
}
