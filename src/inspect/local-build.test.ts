import { expect, test } from "bun:test";
import { localBuildCommand } from "./local-build";

test("the local build runs chrome in this checkout", () => {
  expect(localBuildCommand()).toEqual(["caffeinate", "-s", "autoninja", "-C", "out/Default", "chrome"]);
});
