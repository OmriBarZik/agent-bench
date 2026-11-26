import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH_DIR } from "../../../../paths";
import { compareAnswers } from "./compare-answers";
import { parseSpecVectors, vectorState } from "./spec-vectors";

const SPEC = readFileSync(join(BENCH_DIR, "configs/tasks/dino-ai-player/model/SPEC.md"), "utf8");

test("reads every test vector from the supplied SPEC.md", () => {
  const vectors = parseSpecVectors(SPEC);

  expect(vectors).toHaveLength(9);
  expect(vectors.every((vector) => vector.features.length === 21 && vector.expected.length === 3)).toBe(true);
});

test("a vector becomes the API state whose SPEC features are that vector", () => {
  const ducking = parseSpecVectors(SPEC).find((vector) => vector.label.startsWith("ducking under"));
  const state = vectorState(ducking?.features ?? []);

  expect(state.trex.ducking).toBe(true);
  expect(state.trex.yPos).toBeCloseTo(93);
  expect(state.obstacles).toHaveLength(1);
  expect(state.obstacles[0]?.type).toBe("pterodactyl");
  expect(((state.obstacles[0]?.xPos ?? 0) - state.trex.xPos) / 600).toBeCloseTo(0.195);
  expect(state.currentSpeed / 13).toBeCloseTo(0.675077);
});

test("answers pass only when they match SPEC and name the most likely action", () => {
  const vectors = parseSpecVectors(SPEC).slice(0, 1);
  const right = { decision: "nothing", jump: 0, duck: 0, nothing: 1 };

  expect(compareAnswers({ vectors, answers: [right] }).status).toBe("pass");
  expect(compareAnswers({ vectors, answers: [{ ...right, jump: 0.2, nothing: 0.8 }] }).status).toBe("fail");
  expect(compareAnswers({ vectors, answers: [{ ...right, decision: "jump" }] }).detail).toContain("most likely");
  expect(compareAnswers({ vectors, answers: [{ error: "no DinoDecisionModel" }] }).status).toBe("fail");
});
