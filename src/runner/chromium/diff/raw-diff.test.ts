import { describe, expect, test } from "bun:test";
import { changedFileFromEntry, parseRawDiff } from "./raw-diff";

describe("parseRawDiff", () => {
  test("reads a file edit, a submodule gitlink and a rename", () => {
    const raw = [
      ":100644 100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb M",
      "top.cc",
      ":160000 160000 cccccccccccccccccccccccccccccccccccccccc dddddddddddddddddddddddddddddddddddddddd M",
      "vendor/lib",
      ":100644 100644 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ffffffffffffffffffffffffffffffffffffffff R100",
      "old.cc",
      "new.cc",
      "",
    ].join("\0");
    const entries = parseRawDiff(raw);

    expect(entries.map((entry) => changedFileFromEntry(entry))).toEqual([
      { status: "M", path: "top.cc" },
      { status: "M", path: "vendor/lib" },
      { status: "R", path: "new.cc", previousPath: "old.cc" },
    ]);
    expect(entries[1]).toMatchObject({ oldMode: "160000", newMode: "160000" });
  });

  test("returns nothing for an empty diff", () => {
    expect(parseRawDiff("")).toEqual([]);
  });
});
