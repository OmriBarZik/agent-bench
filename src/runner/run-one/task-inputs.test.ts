import { $ } from "bun";
import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyTaskInputs, listedInputs, withInputs } from "./task-inputs";

async function scratchRepo(): Promise<string> {
  const repo = mkdtempSync(join(tmpdir(), "checkout-"));
  await $`git init -q`.cwd(repo);

  return repo;
}

test("copies a supplied folder into the checkout and refuses paths outside it", async () => {
  const source = mkdtempSync(join(tmpdir(), "task-input-"));
  const chromiumSrc = await scratchRepo();
  writeFileSync(join(source, "model.tflite"), "bytes");

  await copyTaskInputs({ inputFiles: [{ from: source, to: "bench_inputs/model" }], chromiumSrc });

  expect(existsSync(join(chromiumSrc, "bench_inputs/model/model.tflite"))).toBe(true);
  expect(copyTaskInputs({ inputFiles: [{ from: source, to: "../escape" }], chromiumSrc })).rejects.toThrow(
    "inside the checkout",
  );
  expect(copyTaskInputs({ inputFiles: [{ from: join(source, "nope"), to: "x" }], chromiumSrc })).rejects.toThrow(
    "not found",
  );
});

test("supplied files are ignored by git and removed for a task without inputs", async () => {
  const source = mkdtempSync(join(tmpdir(), "task-input-"));
  const chromiumSrc = await scratchRepo();
  writeFileSync(join(source, "SPEC.md"), "spec");
  writeFileSync(join(chromiumSrc, "kept.txt"), "agent work");

  await copyTaskInputs({ inputFiles: [{ from: join(source, "SPEC.md"), to: "bench_inputs/SPEC.md" }], chromiumSrc });
  const status = await $`git status --porcelain --untracked-files=all`.cwd(chromiumSrc).text();

  expect(status).toContain("kept.txt");
  expect(status).not.toContain("bench_inputs");

  await copyTaskInputs({ inputFiles: [], chromiumSrc });

  expect(existsSync(join(chromiumSrc, "bench_inputs/SPEC.md"))).toBe(false);
  expect(readFileSync(join(chromiumSrc, ".git/info/exclude"), "utf8")).not.toContain("bench_inputs");
});

test("withInputs replaces only its own block", () => {
  const first = withInputs({ excludeText: "*.swp\n", destinations: ["bench_inputs/a"] });
  const second = withInputs({ excludeText: first, destinations: ["bench_inputs/b"] });

  expect(listedInputs(first)).toEqual(["bench_inputs/a"]);
  expect(listedInputs(second)).toEqual(["bench_inputs/b"]);
  expect(second.startsWith("*.swp\n")).toBe(true);
  expect(withInputs({ excludeText: second, destinations: [] })).toBe("*.swp\n");
});
