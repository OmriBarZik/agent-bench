import type { Writable } from "node:stream";

/** Prompt text captured while a test answers the discard question. */
export type PromptCapture = {
  /** Stream the question is written to. */
  output: Writable;
  /** Text written so far. */
  text: () => string;
};
