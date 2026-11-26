import { expect, test } from "bun:test";
import { splitPatch } from "./split-patch";

const PATCH = [
  "diff --git a/a.ts b/a.ts",
  "index 1111111..2222222 100644",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1,2 +1,2 @@",
  "-old",
  "+new",
  "+\tmore",
  " same",
  "Submodule sub 3333333..4444444:",
  "diff --git a/sub/new.ts b/sub/new.ts",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/sub/new.ts",
  "@@ -0,0 +1 @@",
  "+hi",
  "diff --git a/old.ts b/moved.ts",
  "similarity index 100%",
  "rename from old.ts",
  "rename to moved.ts",
  "",
].join("\n");

test("splitPatch gives each file its status, line counts and own lines", () => {
  const files = splitPatch(PATCH);

  expect(files.map((file) => [file.path, file.status, file.added, file.removed])).toEqual([
    ["a.ts", "M", 2, 1],
    ["sub/new.ts", "A", 1, 0],
    ["moved.ts", "R", 0, 0],
  ]);
  expect(files[0]?.lines).toHaveLength(9);
  expect(files[0]?.lines[7]).toBe("+    more");
  expect(files[2]?.previousPath).toBe("old.ts");
  expect(files[2]?.lines.at(-1)).toBe("rename to moved.ts");
});

test("splitPatch returns nothing for an empty diff", () => {
  expect(splitPatch("")).toEqual([]);
});
