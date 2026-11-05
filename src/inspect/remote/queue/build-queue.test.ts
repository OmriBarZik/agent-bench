import { expect, test } from "bun:test";
import { queueNotice } from "./build-queue";

test("queueNotice counts the builds that copied an app back", () => {
  const built = { branch: "a", built: true, notice: "built a" };
  const failed = { branch: "b", built: false, notice: "build failed" };

  expect(queueNotice([built, built])).toBe("queued 2 builds");
  expect(queueNotice([built, failed])).toBe("queued 2 builds, 1 built");
  expect(queueNotice([])).toBe("queued 0 builds");
});
