import { expect, test } from "bun:test";
import { blockerAlert } from "./judge-blockers";
import { judgeMetrics, judgementText } from "./judge-result";

test("a blocked verdict keeps its blockers and marks the log line", () => {
  const judge = judgeMetrics({
    result: {
      structured_output: {
        decision: "failed",
        reason: "no build",
        blocked: true,
        blockers: [
          {
            kind: "missing-tool",
            tool: "Bash: autoninja",
            detail: "autoninja is not installed, so nothing was built.",
          },
          { kind: "bogus", tool: "x", detail: "dropped" },
        ],
      },
    },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.blocked).toBe(true);
  expect(judge.blockers).toEqual([
    { kind: "missing-tool", tool: "Bash: autoninja", detail: "autoninja is not installed, so nothing was built." },
  ]);
  expect(judgementText({ judge })).toBe("decision failed, BLOCKED");
  expect(blockerAlert({ runId: "run-1", judge })).toEqual([
    "  !! BLOCKED: run-1 got stuck on a tool",
    "     - missing-tool Bash: autoninja: autoninja is not installed, so nothing was built.",
  ]);
});

test("an unblocked verdict prints no alert", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: "pass", reason: "done", blocked: false, blockers: [] } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.blocked).toBe(false);
  expect(blockerAlert({ runId: "run-1", judge })).toEqual([]);
});

test("a verdict without the blocker fields is not blocked", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: "pass", reason: "done" } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.blocked).toBe(false);
  expect(judge.blockers).toEqual([]);
});
