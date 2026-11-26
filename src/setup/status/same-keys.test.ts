import { expect, test } from "bun:test";
import { differentKeys } from "./same-keys";

const EXPECTED = "language_servers:\n  - typescript\n  - cpp\nread_only: true\n";

test("differentKeys passes a rewritten file with the same values and extra keys", () => {
  const rewritten = "# comment\nlanguage_servers:\n- typescript\n- cpp\n\nread_only: true\nline_ending:\n";

  expect(differentKeys({ expected: EXPECTED, target: rewritten })).toBeUndefined();
});

test("differentKeys names the first key whose value differs or is missing", () => {
  expect(differentKeys({ expected: EXPECTED, target: "language_servers: []\nread_only: true\n" })).toBe(
    "language_servers differs",
  );
  expect(differentKeys({ expected: EXPECTED, target: "language_servers: [typescript, cpp]\n" })).toBe(
    "read_only differs",
  );
  expect(differentKeys({ expected: EXPECTED, target: "- a list\n" })).toBe("not a YAML mapping");
});
