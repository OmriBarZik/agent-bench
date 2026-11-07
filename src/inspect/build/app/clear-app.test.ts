import { afterEach, expect, test } from "bun:test";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearAllChromiumAppCopies, clearChromiumAppCopies, hasChromiumAppCopy } from "./clear-app";
import type { ClearAppProgress } from "./clear-app.types";
import { clearAppNotice, clearAppProgressLines, clearAppProgressNotice, progressBar } from "./clear-progress";

const temps: string[] = [];

afterEach(() => {
  for (const directory of temps.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("clearing one run deletes its folder and never touches Default", async () => {
  const root = tempDir();
  mkdirSync(join(root, "Default"), { recursive: true });
  writeFileSync(join(root, "Default", "keep"), "x");
  mkdirSync(join(root, "dino__haiku__r0", "Chromium.app"), { recursive: true });
  writeFileSync(join(root, "dino__haiku__r0", "Chromium.app", "Contents"), "app");

  expect(hasChromiumAppCopy({ buildDirectory: root, runId: "dino__haiku__r0" })).toBe(true);

  const phases: ClearAppProgress["phase"][] = [];
  const result = await clearChromiumAppCopies({
    buildDirectory: root,
    runIds: ["dino__haiku__r0", "missing"],
    onProgress: (progress) => {
      phases.push(progress.phase);
    },
  });

  expect(result.removed).toEqual([join(root, "dino__haiku__r0")]);
  expect(result.skipped).toEqual(["missing: no copy on disk"]);
  expect(hasChromiumAppCopy({ buildDirectory: root, runId: "dino__haiku__r0" })).toBe(false);
  expect(readFileSync(join(root, "Default", "keep"), "utf8")).toBe("x");
  expect(clearAppNotice(result)).toContain("deleted 1 Chromium.app copy");
  expect(phases).toContain("deleting");
  expect(phases).toContain("deleted");
  expect(phases).toContain("skipped");
  expect(phases.at(-1)).toBe("done");
});

test("clear all removes every run folder and keeps Default and Reports", async () => {
  const root = tempDir();
  mkdirSync(join(root, "Default"), { recursive: true });
  mkdirSync(join(root, "Reports"), { recursive: true });
  mkdirSync(join(root, "run-a"), { recursive: true });
  mkdirSync(join(root, "run-b"), { recursive: true });

  const seen: string[] = [];
  const result = await clearAllChromiumAppCopies({
    buildDirectory: root,
    onProgress: (progress) => {
      if (progress.phase === "deleting") {
        seen.push(progress.runId);
      }
    },
  });

  expect(result.removed.sort()).toEqual([join(root, "run-a"), join(root, "run-b")].sort());
  expect(seen.sort()).toEqual(["run-a", "run-b"]);
  expect(hasChromiumAppCopy({ buildDirectory: root, runId: "Default" })).toBe(false);
  expect(existsSync(join(root, "Default"))).toBe(true);
  expect(existsSync(join(root, "Reports"))).toBe(true);
});

test("freed bytes count each hard link once, not once per name", async () => {
  const root = tempDir();
  const runA = join(root, "run-a");
  const runB = join(root, "run-b");
  mkdirSync(runA, { recursive: true });
  mkdirSync(runB, { recursive: true });
  const payload = "x".repeat(64 * 1024);
  writeFileSync(join(runA, "blob"), payload);
  linkSync(join(runA, "blob"), join(runA, "blob-link"));
  linkSync(join(runA, "blob"), join(runB, "blob"));

  const result = await clearChromiumAppCopies({
    buildDirectory: root,
    runIds: ["run-a", "run-b"],
  });

  // One inode of ~64 KiB, not 3× that from the three directory entries.
  expect(result.freedBytes).toBeGreaterThan(0);
  expect(result.freedBytes).toBeLessThan(200 * 1024);
});

test("progress pane names the current path and lists pending copies", () => {
  const progress: ClearAppProgress = {
    index: 2,
    total: 4,
    runId: "run-b",
    path: "/builds/run-b",
    phase: "deleting",
    removed: ["/builds/run-a"],
    pending: ["run-c", "run-d"],
    skippedCount: 0,
    freedBytes: 12 * 1024 * 1024,
  };

  expect(clearAppProgressNotice(progress)).toBe("[███░░░░░░░] 2/4 deleting run-b · 2 left");
  expect(progressBar({ done: 1, total: 4, width: 8 })).toBe("[██░░░░░░]");

  const text = clearAppProgressLines({ progress, height: 10, columns: 80 }).join("\n");

  expect(text).toContain("Deleting Chromium.app copies");
  expect(text).toContain("deleting  run-b");
  expect(text).toContain("/builds/run-b");
  expect(text).toContain("done     run-a");
  expect(text).toContain("pending  run-c");
  expect(text).toContain("pending  run-d");
  expect(text).toContain("12 MB freed");
});

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "clear-app-"));
  temps.push(directory);

  return directory;
}
