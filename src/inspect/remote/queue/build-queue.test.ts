import { expect, test } from "bun:test";
import { compileFailedRunIds, queueNotice } from "./build-queue";
import type { QueueOutcome } from "./build-queue.types";

test("queueNotice counts the builds that copied an app back", () => {
  const built = outcome({ built: true, notice: "built a" });
  const failed = outcome({ runId: "b", branch: "b", built: false, notice: "build failed", compileFailed: true });

  expect(queueNotice([built, built])).toBe("queued 2 builds");
  expect(queueNotice([built, failed])).toBe("queued 2 builds, 1 built");
  expect(queueNotice([])).toBe("queued 0 builds");
});

test("compileFailedRunIds keeps only runs whose compile failed", () => {
  const built = outcome({ built: true, notice: "built a" });
  const failed = outcome({ runId: "b", branch: "b", built: false, notice: "build failed (1)", compileFailed: true });
  const cancelled = outcome({ runId: "c", branch: "c", built: false, notice: "build cancelled" });

  expect(compileFailedRunIds([built, failed, cancelled])).toEqual(["b"]);
});

function outcome(overrides: Partial<QueueOutcome> = {}): QueueOutcome {
  return {
    runId: "a",
    branch: "a",
    built: true,
    notice: "built a",
    compileFailed: false,
    ...overrides,
  };
}
