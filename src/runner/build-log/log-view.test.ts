import { expect, test } from "bun:test";
import { appendLogText, createLogCursor } from "./log-cursor";
import { applyLogKey, buildLogWanted, scrollLog } from "./log-view";

test("end follows the tail and up scrolls to older lines", () => {
  const view = {
    buildId: 4,
    cursor: appendLogText({ cursor: createLogCursor(), text: "a\nb\nc\n", maxLines: 10 }),
    above: 0,
  };
  const scrolled = applyLogKey({ view, key: "\x1b[A", pageSize: 2, lineCount: 3 });

  expect(scrolled.above).toBe(1);
  expect(applyLogKey({ view: scrolled, key: "\x1b[F", pageSize: 2, lineCount: 3 }).above).toBe(0);
  expect(scrollLog({ view, delta: 100, lineCount: 3 }).above).toBe(2);
});

test("a running build is shown, a hidden one stays hidden, and the next build shows again", () => {
  expect(buildLogWanted({ buildId: 4, dismissedBuildId: null, shownBuildId: null, status: "building" })).toBe(true);
  expect(buildLogWanted({ buildId: 4, dismissedBuildId: 4, shownBuildId: 4, status: "building" })).toBe(false);
  expect(buildLogWanted({ buildId: 4, dismissedBuildId: null, shownBuildId: 4, status: "ok" })).toBe(true);
  expect(buildLogWanted({ buildId: 5, dismissedBuildId: 4, shownBuildId: 4, status: "building" })).toBe(true);
  expect(buildLogWanted({ buildId: null, dismissedBuildId: null, shownBuildId: null, status: null })).toBe(false);
});
