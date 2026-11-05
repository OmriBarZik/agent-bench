import { expect, test } from "bun:test";
import { tabBar, tabStep } from "./tab-bar";

test("tab moves forward, shift-tab moves back, and other keys stay", () => {
  expect(tabStep("\t")).toBe(1);
  expect(tabStep("\x1b[Z")).toBe(-1);
  expect(tabStep("a")).toBe(0);
});

test("the active tab is drawn in reverse video and the hint is dropped when it does not fit", () => {
  const wide = tabBar({ labels: ["Start", "Runs"], active: 1, columns: 80 });
  const narrow = tabBar({ labels: ["Start", "Runs"], active: 1, columns: 14 });

  expect(wide).toContain("\x1b[1;7m Runs \x1b[0m");
  expect(wide).toContain("\x1b[2m Start \x1b[0m");
  expect(wide).toContain("shift-tab");
  expect(narrow).not.toContain("shift-tab");
});
