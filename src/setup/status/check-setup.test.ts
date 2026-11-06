import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHROMIUM_SRC } from "../../paths";
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
