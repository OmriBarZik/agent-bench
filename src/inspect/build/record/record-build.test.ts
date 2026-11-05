import { expect, test } from "bun:test";
import { buildStatus } from "./record-build";

test("a stopped build is cancelled, and any other miss is a failure", () => {
  const signal = new AbortController().signal;
  const stopped = new AbortController();
  stopped.abort();

  expect(buildStatus({ signal, notice: "build failed (1)" })).toBe("failed");
  expect(buildStatus({ signal, notice: "build cancelled" })).toBe("cancelled");
  expect(buildStatus({ signal: stopped.signal, notice: "send branch failed (1)" })).toBe("cancelled");
});
