import { describe, expect, test } from "bun:test";
import { parseNameStatus } from "./chromium";

describe("parseNameStatus", () => {
  test("reads added, modified and deleted paths", () => {
    const changedFiles = parseNameStatus("A\0added.cc\0M\0changed.cc\0D\0removed.cc\0");

    expect(changedFiles).toEqual([
      { status: "A", path: "added.cc" },
      { status: "M", path: "changed.cc" },
      { status: "D", path: "removed.cc" },
    ]);
  });

  test("keeps both paths of a rename or copy", () => {
    const changedFiles = parseNameStatus("R100\0old.cc\0new.cc\0C075\0src.cc\0copy.cc\0");

    expect(changedFiles).toEqual([
      { status: "R", path: "new.cc", previousPath: "old.cc" },
      { status: "C", path: "copy.cc", previousPath: "src.cc" },
    ]);
  });

  test("returns nothing for an empty diff", () => {
    expect(parseNameStatus("")).toEqual([]);
  });
});
