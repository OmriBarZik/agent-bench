import { expect, test } from "bun:test";
import { parseGitlinkDiff } from "./gitlink-diff";

const previous = "a".repeat(40);
const next = "b".repeat(40);
const added = "c".repeat(40);
const renamed = "d".repeat(40);
const zero = "0".repeat(40);

test("parseGitlinkDiff keeps gitlinks and skips files", () => {
  const raw = [
    `:100644 100644 ${previous} ${next} M`,
    "chrome/foo.cc",
    `:160000 160000 ${zero} ${added} A`,
    "third_party/foo",
    `:160000 160000 ${previous} ${renamed} R100`,
    "old/path",
    "vendor/new",
    `:160000 160000 ${previous} ${zero} D`,
    "third_party/gone",
  ].join("\0");

  expect(parseGitlinkDiff(`${raw}\0`)).toEqual([
    { path: "third_party/foo", previousSha: null, sha: added },
    { path: "vendor/new", previousSha: previous, sha: renamed },
    { path: "third_party/gone", previousSha: previous, sha: null },
  ]);
});

test("parseGitlinkDiff is empty when nothing changed", () => {
  expect(parseGitlinkDiff("")).toEqual([]);
});
