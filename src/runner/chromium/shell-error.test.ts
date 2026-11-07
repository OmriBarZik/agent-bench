import { expect, test } from "bun:test";
import { shellErrorMessage } from "./shell-error";

test("shellErrorMessage prefers stderr over the generic Bun message", () => {
  const error = {
    exitCode: 128,
    message: "Failed with exit code 128",
    stderr: "fatal: Unable to create '/src/.git/index.lock': File exists\n",
    stdout: "",
  };

  expect(shellErrorMessage({ label: "git reset --hard", error })).toBe(
    "git reset --hard failed (128): fatal: Unable to create '/src/.git/index.lock': File exists",
  );
});

test("shellErrorMessage falls back when there is no stderr", () => {
  expect(shellErrorMessage({ label: "git clean", error: { exitCode: 1, stderr: "", stdout: "" } })).toBe(
    "git clean failed (1)",
  );
  expect(shellErrorMessage({ label: "sync", error: new Error("boom") })).toBe("sync failed: boom");
});
