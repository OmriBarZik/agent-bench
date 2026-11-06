import { expect, test } from "bun:test";
import { enableCheckoutClangd, gclientChecksOutClangd } from "./gclient-clangd";

const EMPTY_VARS = `solutions = [
  {
    "name": "src",
    "url": "https://chromium.googlesource.com/chromium/src.git",
    "custom_deps": {},
    "custom_vars": {},
  },
]
`;

test("an empty custom_vars does not check out clangd", () => {
  expect(gclientChecksOutClangd(EMPTY_VARS)).toBe(false);
});

test("enableCheckoutClangd adds checkout_clangd to an empty custom_vars", () => {
  const updated = enableCheckoutClangd(EMPTY_VARS);

  expect(gclientChecksOutClangd(updated)).toBe(true);
  expect(updated).toContain(`"custom_vars": {
      "checkout_clangd": True,
    }`);
  expect(updated).toContain('"custom_deps": {}');
});

test("enableCheckoutClangd keeps other custom vars and turns False into True", () => {
  const source = `solutions = [
  {
    "name": "src",
    "custom_vars": {
      "checkout_pgo_profiles": True,
      "checkout_clangd": False,
    },
  },
  {
    "name": "other",
    "custom_vars": {},
  },
]
`;
  const updated = enableCheckoutClangd(source);

  expect(updated).toContain('"checkout_pgo_profiles": True');
  expect(updated).toContain('"checkout_clangd": True');
  expect(updated).not.toContain('"checkout_clangd": False');
  expect(updated).toContain(`"name": "other",
    "custom_vars": {},`);
});

test("enableCheckoutClangd inserts custom_vars when the src solution has none", () => {
  const source = `solutions = [
  {
    "name": "src",
    "custom_deps": {},
  },
]
`;
  const updated = enableCheckoutClangd(source);

  expect(gclientChecksOutClangd(updated)).toBe(true);
  expect(updated).toContain('"custom_deps": {}');
  expect(updated).toContain('"custom_vars": {"checkout_clangd": True},');
});

test("enableCheckoutClangd leaves a file that already checks out clangd unchanged", () => {
  const source = enableCheckoutClangd(EMPTY_VARS);

  expect(enableCheckoutClangd(source)).toBe(source);
});
