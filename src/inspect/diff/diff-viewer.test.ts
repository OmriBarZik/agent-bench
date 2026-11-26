import { expect, test } from "bun:test";
import { applyDiffKey, diffViewerBack } from "./diff-viewer";
import type { DiffViewer, FileDiff } from "./run-diff.types";

const DOWN = "\x1b[B";

function file(path: string): FileDiff {
  return { path, status: "M", added: 1, removed: 0, lines: Array.from({ length: 30 }, (_, index) => `+${index}`) };
}

const viewer: DiffViewer = {
  runId: "run",
  label: "task × config",
  range: "a..b",
  files: [file("one.ts"), file("two.ts"), file("three.ts")],
  mode: "files",
  selected: 0,
  listScroll: 0,
  patchScroll: 0,
};

test("the file list moves, opens a patch on enter, and esc steps back then closes", () => {
  const moved = applyDiffKey({ viewer, key: DOWN, rows: 10 });
  expect(moved.selected).toBe(1);

  const patch = applyDiffKey({ viewer: moved, key: "\r", rows: 10 });
  expect(patch.mode).toBe("patch");

  const back = diffViewerBack(patch);
  expect(back?.mode).toBe("files");
  expect(back?.selected).toBe(1);
  expect(back && diffViewerBack(back)).toBeNull();
});

test("a patch scrolls within its lines and n / p step through files", () => {
  const patch = { ...viewer, mode: "patch" as const };
  const end = applyDiffKey({ viewer: patch, key: "\x1b[F", rows: 10 });
  expect(end.patchScroll).toBe(23);

  const next = applyDiffKey({ viewer: end, key: "n", rows: 10 });
  expect([next.selected, next.patchScroll]).toEqual([1, 0]);
  expect(applyDiffKey({ viewer: patch, key: "p", rows: 10 }).selected).toBe(0);
});
