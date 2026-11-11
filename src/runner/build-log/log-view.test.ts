import { expect, test } from "bun:test";
import { appendLogText, createLogCursor } from "./log-cursor";
import { mkdtempSync, appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentBuildView } from "../../db/db.types";
import { applyLogKey, buildLogWanted, createLogView, scrollLog, syncLogView } from "./log-view";

test("end follows the tail and up scrolls to older lines", () => {
  const view = {
    buildId: 4,
    cursor: appendLogText({ cursor: createLogCursor(), text: "a\nb\nc\n", maxLines: 10 }),
    above: 0,
    unseen: 0,
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

test("at the tail new lines follow; scrolled up the window stays put and counts new lines", () => {
  const path = join(mkdtempSync(join(tmpdir(), "log-view-")), "build.log");
  writeFileSync(path, "a\nb\nc\n");
  const build: AgentBuildView = {
    id: 7,
    run_id: null,
    build_number: 1,
    status: "building",
    log_path: path,
    started_at: null,
    task_id: null,
    config_id: null,
    repeat: null,
  };
  const first = syncLogView({ view: createLogView(), build });
  appendFileSync(path, "d\n");
  const following = syncLogView({ view: first, build });

  expect(following.above).toBe(0);
  expect(following.unseen).toBe(0);

  const scrolled = scrollLog({ view: following, delta: 2, lineCount: 4 });
  appendFileSync(path, "e\nf\n");
  const pinned = syncLogView({ view: scrolled, build });

  expect(pinned.above).toBe(4);
  expect(pinned.unseen).toBe(2);
  expect(applyLogKey({ view: pinned, key: "\x1b[F", pageSize: 2, lineCount: 6 }).unseen).toBe(0);
});
