import { expect, test } from "bun:test";
import { splitRounds } from "./split-rounds";

const BUILD = "mcp__chrome-validate__";
let clock = 0;
let messageCount = 0;

function assistant(calls: { name: string; input?: object }[]): string[] {
  messageCount += 1;
  clock += 10_000;
  const id = `msg_${messageCount}`;

  return calls.map((call, index) =>
    JSON.stringify({
      type: "assistant",
      timestamp: new Date(clock).toISOString(),
      message: {
        id,
        usage: { input_tokens: 10, output_tokens: 10 },
        content: [{ type: "tool_use", id: `${id}_${index}`, name: call.name, input: call.input ?? {} }],
      },
    }),
  );
}

function result({ callId, text, isError = false }: { callId: string; text: string; isError?: boolean }): string {
  clock += 60_000;

  return JSON.stringify({
    type: "user",
    timestamp: new Date(clock).toISOString(),
    message: { content: [{ type: "tool_result", tool_use_id: callId, is_error: isError, content: text }] },
  });
}

test("splitRounds starts a new round after a failed build and counts tools by segment", () => {
  clock = 0;
  messageCount = 0;
  const lines = [
    ...assistant([{ name: "Bash", input: { command: "rg -n Dino components | head" } }, { name: "Read" }]),
    ...assistant([{ name: "Edit", input: { file_path: "/x/src/a.ts" } }, { name: `${BUILD}start_build` }]),
    ...assistant([{ name: `${BUILD}wait_build` }]),
    result({ callId: "msg_3_0", text: "Build 1 (snapshot ab) failed after 30 s.", isError: true }),
    ...assistant([{ name: "Bash", input: { command: "grep -n Dino a.ts" } }]),
    ...assistant([{ name: "Edit", input: { file_path: "b.ts" } }, { name: `${BUILD}start_build` }]),
    ...assistant([{ name: `${BUILD}wait_build` }]),
    result({ callId: "msg_6_0", text: "Build 2 (snapshot cd) ok after 90 s." }),
    ...assistant([{ name: `${BUILD}run_chrome` }]),
    result({ callId: "msg_7_0", text: "opened chrome://dino" }),
    ...assistant([]),
  ];
  const rounds = splitRounds({ lines, costUsd: 1, setupTools: ["rg"], finalPaths: new Set(["b.ts"]) });

  expect(rounds.results.map((round) => round.outcome)).toEqual(["build_failed", "checked"]);
  expect(rounds.results[1]).toMatchObject({ builds: 1, chromeRuns: 1, editedFiles: 1, keptFiles: 1, isLast: true });
  expect(rounds.results[0]).toMatchObject({ failedBuilds: 1, keptFiles: 0 });
  expect(rounds.segments.map((segment) => `${segment.round}:${segment.segment}`)).toEqual([
    "1:discovery",
    "1:implementation",
    "1:validation",
    "2:discovery",
    "2:implementation",
    "2:validation",
  ]);
  expect(rounds.tools).toContainEqual({
    round: 1,
    segment: "discovery",
    tool: "rg",
    kind: "search",
    setupTool: true,
    calls: 1,
  });
  expect(rounds.tools).toContainEqual({
    round: 2,
    segment: "discovery",
    tool: "grep",
    kind: "search",
    setupTool: false,
    calls: 1,
  });
  expect(rounds.segments.reduce((total, segment) => total + (segment.costUsd ?? 0), 0)).toBeCloseTo(1);
});
