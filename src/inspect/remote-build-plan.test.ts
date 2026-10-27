import { expect, test } from "bun:test";
import { branchRefspec, copyBackCommand, remoteBuildScript } from "./remote-build-plan";

test("the remote script builds chrome and checks out sent submodule commits", () => {
  const sha = "a".repeat(40);
  const script = remoteBuildScript({
    argsGn: "is_debug = false\n",
    commits: [{ path: "third_party/foo", sha }],
  });

  expect(script).toContain("autoninja -C out/Default chrome");
  expect(script).toContain(`git -C "$source_dir/third_party/foo" checkout --quiet --force --detach ${sha}`);
  expect(script).toContain("git clean -fdq");
  expect(script).not.toContain("clean -fdx");
  expect(script).toContain("is_debug = false");
  expect(script).toContain("if [ ! -f out/Default/args.gn ]");
  expect(script).toContain('PATH="$depot_tools:$PATH"');
  expect(script).not.toContain("$HOME/depot_tools");
});

test("copying the build leaves object files on the builder", () => {
  const command = copyBackCommand({
    host: "builder",
    source: "/chromium/src",
    destination: "/tmp/chrome-builds/run",
  });

  expect(command).toContain("--exclude");
  expect(command).toContain("obj");
  expect(command).toContain("builder:/chromium/src/out/Default/");
  expect(command.at(-1)).toBe("/tmp/chrome-builds/run/");
});

test("the run branch refspec updates only that branch on the builder", () => {
  expect(branchRefspec("dino__haiku__r0")).toBe("+refs/heads/dino__haiku__r0:refs/heads/dino__haiku__r0");
  expect(() => branchRefspec("dino haiku")).toThrow(/branch/);
});
