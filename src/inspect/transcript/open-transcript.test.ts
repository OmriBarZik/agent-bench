import { expect, test } from "bun:test";
import { transcriptCommand } from "./open-transcript";

test("transcriptCommand opens one jsonl session in the browser", () => {
  expect(transcriptCommand("/runs/dino/transcript.jsonl")).toEqual([
    "uvx",
    "claude-code-transcripts",
    "json",
    "/runs/dino/transcript.jsonl",
    "--open",
  ]);
});
