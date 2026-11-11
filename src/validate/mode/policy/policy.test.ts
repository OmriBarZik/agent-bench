import { expect, test } from "bun:test";
import { runChromeRefusal } from "./run-chrome-policy";

test("a dino check may play the harness, but not eval or open another page", () => {
  const actions = [{ key: "Space" }, { state: true as const }, { screenshot: true as const }];
  expect(runChromeRefusal({ mode: "dino", url: "dino", actions })).toBeNull();
  expect(runChromeRefusal({ mode: "dino", url: "chrome://dino", actions: [] })).toBeNull();
  expect(runChromeRefusal({ mode: "dino", url: "dino", actions: [{ eval: "Runner.getInstance()" }] })).toContain(
    "eval is off",
  );
  expect(runChromeRefusal({ mode: "dino", url: "http://127.0.0.1:1234/", actions: [] })).toContain(
    "only the dino harness",
  );
});

test("a DevTools check may click and play a DevTools page, but not eval or open chrome://dino", () => {
  const url = "devtools://devtools/bundled/devtools_app.html?panel=dino";
  const actions = [{ click: { x: 100, y: 200 } }, { key: "Space" }, { state: true as const }];
  expect(runChromeRefusal({ mode: "devtools", url, actions })).toBeNull();
  expect(runChromeRefusal({ mode: "devtools", url, actions: [{ eval: "1" }] })).toContain("eval is off");
  expect(runChromeRefusal({ mode: "devtools", url: "chrome://dino", actions: [] })).toContain("only DevTools pages");
});

test("a full chrome check may eval any page", () => {
  expect(runChromeRefusal({ mode: "chrome", url: "chrome://dino", actions: [{ eval: "1" }] })).toBeNull();
});
