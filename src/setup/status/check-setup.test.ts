import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BENCH_DIR, CHROMIUM_SRC } from "../../paths";
import { readTaskShas } from "../index-stamp/task-shas";
import { checkSetup, expandTarget } from "./check-setup";
import { readSetupFile } from "./read-setup";

test("expandTarget fills the checkout, the home directory, and the index defaults", () => {
  expect(expandTarget("${CHROMIUM_SRC}/compile_commands.json")).toBe(`${CHROMIUM_SRC}/compile_commands.json`);
  expect(expandTarget("${HOME}/.csearchindex")).toContain(".csearchindex");
  expect(expandTarget("${CSEARCHINDEX}")).not.toContain("${");
  expect(expandTarget("${CBM_CACHE_DIR}")).not.toContain("${");
  expect(expandTarget("${NOT_A_SETUP_VAR}")).toBe("${NOT_A_SETUP_VAR}");
});

test("a file check passes only when that file exists", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setup-"));

  try {
    const file = join(directory, "clangd");
    const missing = checkSetup({ label: "clangd", kind: "file", target: file, fix: "gclient sync" });

    expect(missing.ok).toBe(false);
    expect(missing.fix).toBe("gclient sync");
    writeFileSync(file, "");
    expect(checkSetup({ label: "clangd", kind: "file", target: file }).ok).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a directory check can require the directory to contain something", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setup-"));

  try {
    const cache = join(directory, "cache");
    mkdirSync(cache);
    expect(checkSetup({ label: "index", kind: "directory", target: cache, nonEmpty: true }).ok).toBe(false);
    writeFileSync(join(cache, "graph"), "");
    expect(checkSetup({ label: "index", kind: "directory", target: cache, nonEmpty: true }).ok).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a command check looks the name up on PATH", () => {
  expect(checkSetup({ label: "bun", kind: "command", target: "bun" }).ok).toBe(true);
  expect(checkSetup({ label: "missing", kind: "command", target: "agent-bench-not-a-command" }).ok).toBe(false);
});

test("readSetupFile reports a missing file and an unknown key", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setup-"));

  try {
    const path = join(directory, "setup.json");

    expect(readSetupFile(path).problem?.kind).toBe("missing-file");
    writeFileSync(path, JSON.stringify({ checks: [], extra: true }));
    expect(readSetupFile(path).problem?.detail).toContain("unknown key");
    writeFileSync(path, JSON.stringify({ checks: [{ label: "sift", kind: "command", target: "sift" }] }));
    expect(readSetupFile(path).checks[0]).toMatchObject({ label: "sift", kind: "command", target: "sift" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an index-stamp check passes only for a clean stamp at the tasks' SHA", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setup-"));

  try {
    const path = join(directory, "index-stamp.json");
    const [taskSha] = readTaskShas();
    const spec = { label: "index", kind: "index-stamp" as const, target: path };

    expect(checkSetup(spec).detail).toContain("no index stamp");
    writeFileSync(path, JSON.stringify({ sha: taskSha, dirty: [] }));
    expect(checkSetup(spec).ok).toBe(true);
    writeFileSync(path, JSON.stringify({ sha: taskSha, dirty: ["?? leftover.ts"] }));
    expect(checkSetup(spec)).toMatchObject({ ok: false, detail: expect.stringContaining("dirty") });
    writeFileSync(path, JSON.stringify({ sha: "0".repeat(40), dirty: [] }));
    expect(checkSetup(spec).ok).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a file check with sameAs fails when a value differs from the repo file", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-setup-"));

  try {
    const path = join(directory, "project.yml");
    const spec = { label: "project", kind: "file" as const, target: path, sameAs: "configs/setup/serena/project.yml" };

    writeFileSync(path, "language_servers: []\n");
    expect(checkSetup(spec)).toMatchObject({ ok: false, detail: expect.stringContaining("differs from") });
    writeFileSync(path, readFileSync(join(BENCH_DIR, "configs/setup/serena/project.yml")));
    expect(checkSetup(spec).ok).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
