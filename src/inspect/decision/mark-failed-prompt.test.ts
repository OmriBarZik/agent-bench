import { expect, test } from "bun:test";
import { applyMarkFailedKey, markFailedPromptLines, openMarkFailedPrompt } from "./mark-failed-prompt";
import type { MarkFailedRun } from "./mark-failed-prompt.types";

const runs: MarkFailedRun[] = [
  { runId: "dino__haiku__r0", taskId: "dino", configId: "haiku" },
  { runId: "dino__haiku__r1", taskId: "dino", configId: "sonnet" },
];

test("nothing to ask when no compile failed", () => {
  expect(openMarkFailedPrompt([])).toBeNull();
});

test("the question opens on No, and y marks the run failed", () => {
  const opened = openMarkFailedPrompt(["dino__haiku__r0"]);

  expect(opened).toEqual({ runIds: ["dino__haiku__r0"], selected: 0 });
  expect(applyMarkFailedKey({ prompt: opened ?? { runIds: [], selected: 0 }, key: "y" })).toEqual({
    kind: "answer",
    runId: "dino__haiku__r0",
    markFailed: true,
    prompt: null,
  });
});

test("n and enter keep the decision, and a queue moves on to the next run", () => {
  const opened = openMarkFailedPrompt(["dino__haiku__r0", "dino__haiku__r1"]);

  if (!opened) {
    throw new Error("expected a question");
  }

  const kept = applyMarkFailedKey({ prompt: opened, key: "n" });
  const next = kept.kind === "answer" ? kept.prompt : null;
  const marked = next ? applyMarkFailedKey({ prompt: next, key: "\r" }) : kept;

  expect(kept).toEqual({
    kind: "answer",
    runId: "dino__haiku__r0",
    markFailed: false,
    prompt: { runIds: ["dino__haiku__r1"], selected: 0 },
  });
  expect(marked).toEqual({
    kind: "answer",
    runId: "dino__haiku__r1",
    markFailed: false,
    prompt: null,
  });
});

test("arrows move to yes, and 2 marks the run failed", () => {
  const opened = openMarkFailedPrompt(["dino__haiku__r0"]);

  if (!opened) {
    throw new Error("expected a question");
  }

  const down = applyMarkFailedKey({ prompt: opened, key: "\x1b[B" });

  if (down.kind !== "stay") {
    throw new Error("expected the highlight to move");
  }

  expect(down.prompt.selected).toBe(1);
  expect(applyMarkFailedKey({ prompt: down.prompt, key: "\r" })).toEqual({
    kind: "answer",
    runId: "dino__haiku__r0",
    markFailed: true,
    prompt: null,
  });
  expect(applyMarkFailedKey({ prompt: opened, key: "2" })).toEqual({
    kind: "answer",
    runId: "dino__haiku__r0",
    markFailed: true,
    prompt: null,
  });
  expect(applyMarkFailedKey({ prompt: opened, key: "q" })).toEqual({ kind: "stay", prompt: opened });
});

test("the question names the run whose build failed", () => {
  const opened = openMarkFailedPrompt(["dino__haiku__r0", "dino__haiku__r1"]);
  const lines = markFailedPromptLines({
    prompt: opened ?? { runIds: [], selected: 0 },
    choices: runs,
    height: 8,
    columns: 80,
  });
  const text = lines.join("\n");

  expect(text).toContain("Build failed. Mark dino × haiku as failed?  (2 failed)");
  expect(text).toContain("1  No, keep the decision");
  expect(text).toContain("2  Yes, mark it failed");
  expect(text).toContain("esc dismisses");
  expect(lines[1]).toContain("\x1b[7m");
});
