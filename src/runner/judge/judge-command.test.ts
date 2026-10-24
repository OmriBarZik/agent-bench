import { expect, test } from "bun:test";
import { judgeCommand } from "./judge";

test("judgeCommand persists the session so the transcript can be opened later", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const command = judgeCommand({ prompt: "score it", judgeModel: "claude-sonnet-5-5", sessionId });

  expect(command).toContain("--session-id");
  expect(command).toContain(sessionId);
  expect(command).not.toContain("--no-session-persistence");
  const schema = JSON.parse(command[command.indexOf("--json-schema") + 1]) as {
    required: string[];
    properties: { decision: { enum: string[] } };
  };
  expect(schema.required).toContain("decision");
  expect(schema.properties.decision.enum).toEqual(["failed", "partially-failed", "partially-pass", "pass"]);
});
