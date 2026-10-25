import { describe, expect, test } from "bun:test";
import { bashPrograms } from "./bash-programs";

describe("bashPrograms", () => {
  test("names each program in a pipeline, after assignments, wrappers, and paths", () => {
    expect(bashPrograms("FOO=1 rg x | head && ./out/mytool y")).toEqual(["rg", "head", "mytool"]);
    expect(bashPrograms("sudo -n git status")).toEqual(["git"]);
    expect(bashPrograms("env FOO=1 rg x")).toEqual(["rg"]);
    expect(bashPrograms("find . -exec sed -n p {} \\;")).toEqual(["find", "sed"]);
  });

  test("keeps a quoted pipe inside the command that contains it", () => {
    expect(bashPrograms('grep -n "updateJump\\|scale(\\|drawHat" file.ts')).toEqual(["grep"]);
    expect(bashPrograms("git diff --stat && git grep -n 'resetHat\\|drawHat' -- components")).toEqual(["git", "git"]);
  });

  test("includes the command a nested script runs", () => {
    expect(bashPrograms("bash -c 'git status && rg foo'")).toEqual(["bash", "git", "rg"]);
    expect(bashPrograms("command -v cd")).toEqual(["command"]);
  });

  test("returns nothing when there is no script", () => {
    expect(bashPrograms("")).toEqual([]);
    expect(bashPrograms("   ")).toEqual([]);
  });
});
