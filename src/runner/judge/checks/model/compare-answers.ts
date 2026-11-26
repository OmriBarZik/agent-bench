import type { ApiAnswer, ModelVerdict, SpecVector } from "./model-check.types";

/** SPEC.md rounds to 4 decimals; a float32 TFLite run of the same file is far closer than this. */
const TOLERANCE = 1e-3;
const KEYS = ["jump", "duck", "nothing"] as const;

/** Whether every answer matches its SPEC vector, with a detail line the judge can read. */
export function compareAnswers({ vectors, answers }: { vectors: SpecVector[]; answers: ApiAnswer[] }): ModelVerdict {
  const problems: string[] = [];

  vectors.forEach((vector, index) => {
    const problem = answerProblem({ vector, answer: answers[index] ?? { error: "no answer" } });

    if (problem) {
      problems.push(`${vector.label}: ${problem}`);
    }
  });

  if (problems.length === 0) {
    return {
      status: "pass",
      detail: `DinoDecisionModel.decide() on chrome://dino matched all ${vectors.length} SPEC.md test vectors within ${TOLERANCE}, so the build runs the supplied model.`,
    };
  }

  return {
    status: "fail",
    detail: `DinoDecisionModel.decide() on chrome://dino did not match SPEC.md for ${problems.length} of ${vectors.length} test vectors: ${problems.slice(0, 4).join("; ")}.`,
  };
}

function answerProblem({ vector, answer }: { vector: SpecVector; answer: ApiAnswer }): string | null {
  if (answer.error) {
    return answer.error;
  }

  const got = KEYS.map((key) => answer[key]);

  if (got.some((value) => typeof value !== "number")) {
    return `returned ${JSON.stringify(answer)}, not { decision, jump, duck, nothing }`;
  }

  const numbers = got as number[];
  const off = numbers.some((value, index) => Math.abs(value - (vector.expected[index] ?? 0)) > TOLERANCE);
  const best = KEYS[numbers.indexOf(Math.max(...numbers))];

  if (off) {
    return `got [${numbers.map((value) => value.toFixed(4)).join(", ")}], expected [${vector.expected.join(", ")}]`;
  }

  if (answer.decision !== best) {
    return `decision "${answer.decision}" is not the most likely action "${best}"`;
  }

  return null;
}
