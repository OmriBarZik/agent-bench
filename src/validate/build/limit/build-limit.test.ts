import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildJob } from "../build-job.types";
import { armBuildLimit, readBuildTimeoutMs } from "./build-limit";

test("the build limit aborts the job and says so in the log", () => {
  const directory = mkdtempSync(join(tmpdir(), "build-limit-"));
  const logPath = join(directory, "build-1.log");
  const job = fakeJob();
  const held: { fire: (() => void) | null } = { fire: null };

  try {
    const stop = armBuildLimit({
      job,
      logPath,
      timeoutMs: 90 * 60_000,
      now: () => job.startedAt,
      setTimer: (callback) => {
        held.fire = callback;

        return () => {
          held.fire = null;
        };
      },
    });

    held.fire?.();

    expect(job.timedOut).toBe(true);
    expect(job.controller.signal.aborted).toBe(true);
    expect(readFileSync(logPath, "utf8")).toContain("Build timed out after 90 min.");
    stop();
    expect(held.fire).toBeNull();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a missing build timeout means no limit", () => {
  expect(readBuildTimeoutMs({})).toBeNull();
  expect(readBuildTimeoutMs({ BENCH_BUILD_TIMEOUT_MS: "15000" })).toBe(15_000);
  expect(readBuildTimeoutMs({ BENCH_BUILD_TIMEOUT_MS: "nope" })).toBeNull();
});

function fakeJob(): BuildJob {
  return {
    number: 1,
    snapshotSha: "abc",
    startedAt: 1_000,
    controller: new AbortController(),
    timedOut: false,
    done: Promise.resolve({
      status: "failed",
      appPath: null,
      artifactPath: null,
      outputDir: null,
      durationMs: 0,
      failedStep: null,
      error: null,
      logPath: "",
    }),
    outcome: null,
  };
}
