import { describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import { CHROMIUM_SRC } from "../../paths";
import { confirmDiscardUncommittedChanges } from "./confirm-discard";
import type { PromptCapture } from "./confirm-discard.test.types";

describe("confirmDiscardUncommittedChanges", () => {
  test("a terminal yes deletes the changes", async () => {
    const { output, text } = sink();
    const discard = await confirmDiscardUncommittedChanges({
      signal: new AbortController().signal,
      status: " M file.cc",
      input: scriptedInput("y\n"),
      output,
    });

    expect(discard).toBe(true);
    expect(text()).toContain(CHROMIUM_SRC);
    expect(text()).toContain(" M file.cc");
    expect(text()).toContain("Delete them and continue? [y/N] ");
  });

  test("yes is accepted in any case", async () => {
    for (const answer of ["yes", "YES", " Yes "]) {
      const discard = await confirmDiscardUncommittedChanges({
        signal: new AbortController().signal,
        status: " M file.cc",
        input: scriptedInput(`${answer}\n`),
        output: sink().output,
      });

      expect(discard).toBe(true);
    }
  });

  test("anything else keeps the changes", async () => {
    for (const answer of ["n", "no", "", "yeah", "yep"]) {
      const discard = await confirmDiscardUncommittedChanges({
        signal: new AbortController().signal,
        status: " M file.cc",
        input: scriptedInput(`${answer}\n`),
        output: sink().output,
      });

      expect(discard).toBe(false);
    }
  });

  test("a non-terminal session does not ask", async () => {
    const { output, text } = sink();
    const discard = await confirmDiscardUncommittedChanges({
      signal: new AbortController().signal,
      status: " M file.cc",
      input: new PassThrough(),
      output,
    });

    expect(discard).toBe(false);
    expect(text()).toBe("");
  });

  test("an aborted prompt does not delete", async () => {
    const controller = new AbortController();
    controller.abort();
    const discard = await confirmDiscardUncommittedChanges({
      signal: controller.signal,
      status: " M file.cc",
      input: scriptedInput("y\n"),
      output: sink().output,
    });

    expect(discard).toBe(false);
  });

  test("ctrl+c during the question does not delete", async () => {
    const controller = new AbortController();
    const input = openInput();
    const pending = confirmDiscardUncommittedChanges({
      signal: controller.signal,
      status: " M file.cc",
      input,
      output: sink().output,
    });
    controller.abort();

    expect(await pending).toBe(false);
  });

  test("a long status is shortened in the question", async () => {
    const lines: string[] = [];

    for (let index = 0; index < 21; index++) {
      lines.push(` M file-${index}.cc`);
    }

    const { output, text } = sink();
    await confirmDiscardUncommittedChanges({
      signal: new AbortController().signal,
      status: lines.join("\n"),
      input: scriptedInput("n\n"),
      output,
    });

    expect(text()).toContain(" M file-19.cc");
    expect(text()).toContain("... and 1 more");
    expect(text()).not.toContain(" M file-20.cc");
  });
});

function scriptedInput(text: string): PassThrough {
  const input = openInput();
  input.end(text);

  return input;
}

function openInput(): PassThrough {
  const input = new PassThrough();
  Object.defineProperty(input, "isTTY", { value: true });

  return input;
}

function sink(): PromptCapture {
  let written = "";
  const output = new Writable({
    write(chunk, encoding, callback) {
      written += String(chunk);
      callback();
    },
  });

  return {
    output,
    text: () => written,
  };
}
