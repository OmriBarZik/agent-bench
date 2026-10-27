import { expect, test } from "bun:test";
import { checkoutReadyCommand, connectCommand, remoteFailure } from "./validate-remote";

test("the remote check uses a non-interactive SSH connection", () => {
  expect(connectCommand("builder")).toEqual([
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    "builder",
    "true",
  ]);
  expect(checkoutReadyCommand({ host: "builder", source: "/src" })).toContain("/src");
});

test("a failed check explains what to fix and does not start a build", () => {
  expect(remoteFailure({ check: "connect", exitCode: 255, host: "builder", source: "/src" })).toContain(
    "cannot reach builder",
  );
  expect(remoteFailure({ check: "checkout", exitCode: 1, host: "builder", source: "/src" })).toContain(
    "/src on builder is not a git checkout",
  );
});
