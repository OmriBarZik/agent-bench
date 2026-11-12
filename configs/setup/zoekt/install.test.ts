import { expect, test } from "bun:test";
import { isSupportedGo, pathHasDir } from "./install";

test("isSupportedGo accepts Go 1.26 and newer", () => {
  expect(isSupportedGo("go version go1.26.1 darwin/arm64")).toBe(true);
  expect(isSupportedGo("go version go1.27.3 linux/amd64")).toBe(true);
  expect(isSupportedGo("go version go1.25.0 darwin/arm64")).toBe(false);
  expect(isSupportedGo("not go")).toBe(false);
});

test("pathHasDir matches a PATH entry", () => {
  expect(pathHasDir({ pathValue: "/usr/bin:/home/me/go/bin", binDir: "/home/me/go/bin" })).toBe(true);
  expect(pathHasDir({ pathValue: "/usr/bin:/home/me/go/bin/", binDir: "/home/me/go/bin" })).toBe(true);
  expect(pathHasDir({ pathValue: "/usr/bin", binDir: "/home/me/go/bin" })).toBe(false);
  expect(pathHasDir({ pathValue: "", binDir: "/home/me/go/bin" })).toBe(false);
});
