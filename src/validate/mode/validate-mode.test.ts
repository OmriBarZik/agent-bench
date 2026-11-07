import { expect, test } from "bun:test";
import { readValidateMode, stockChromiumApp, validateBuildPlan } from "./validate-mode";

test("readValidateMode defaults to chrome", () => {
  expect(readValidateMode({})).toBe("chrome");
  expect(readValidateMode({ BENCH_VALIDATE_MODE: "" })).toBe("chrome");
  expect(readValidateMode({ BENCH_VALIDATE_MODE: "dino" })).toBe("dino");
  expect(readValidateMode({ BENCH_VALIDATE_MODE: "devtools" })).toBe("devtools");
});

test("readValidateMode rejects an unknown mode", () => {
  expect(() => readValidateMode({ BENCH_VALIDATE_MODE: "wasm" })).toThrow("BENCH_VALIDATE_MODE");
});

test("validateBuildPlan picks the light targets", () => {
  expect(validateBuildPlan("chrome").ninjaTarget).toBe("chrome");
  expect(validateBuildPlan("chrome").copyPaths).toBeNull();
  expect(validateBuildPlan("dino").ninjaTarget).toBe("components/neterror/resources:build_ts");
  expect(validateBuildPlan("dino").copyPaths?.length).toBeGreaterThan(0);
  expect(validateBuildPlan("devtools").ninjaTarget).toContain("devtools_frontend_resources");
  expect(validateBuildPlan("devtools").artifactRelativePath).toContain("front_end");
});

test("stockChromiumApp sits under out/Default", () => {
  expect(stockChromiumApp("/src")).toBe("/src/out/Default/Chromium.app");
});
