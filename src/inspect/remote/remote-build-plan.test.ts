import { expect, test } from "bun:test";
import { branchRefspec, copyBackCommand, copyPathsScript, remoteBuildScript } from "./remote-build-plan";

test("the remote script builds chrome and checks out sent submodule commits", () => {
  const sha = "a".repeat(40);
  const script = remoteBuildScript({
    argsGn: "is_debug = false\n",
    commits: [{ path: "third_party/foo", sha }],
  });

  expect(script).toContain("autoninja --fast_local -C out/Default chrome");
  expect(script).toContain(`git -C "$source_dir/third_party/foo" checkout --quiet --force --detach ${sha}`);
  expect(script).toContain("git clean -fdq");
  expect(script).not.toContain("clean -fdx");
  expect(script).toContain("is_debug = false");
  expect(script).toContain('cmp -s out/Default/args.gn "$desired_args"');
  expect(script).toContain("ccache is not on PATH");
  expect(script).toContain("max_size=50GiB");
  expect(script).toContain('PATH="$depot_tools:$PATH"');
  expect(script).not.toContain("$HOME/depot_tools");
});

test("the remote script can build a light ninja target", () => {
  const script = remoteBuildScript({
    argsGn: "is_debug = false\n",
    commits: [],
    ninjaTarget: "components/neterror/resources:build_ts",
  });

  expect(script).toContain("autoninja --fast_local -C out/Default components/neterror/resources:build_ts");
  expect(script).not.toMatch(/autoninja --fast_local -C out\/Default chrome$/m);
});

test("a ninja target with a dash in its path is accepted, and a shell character is not", () => {
  const devtools = "third_party/devtools-frontend/src:devtools_frontend_resources";

  expect(remoteBuildScript({ argsGn: "", commits: [], ninjaTarget: devtools })).toContain(
    `autoninja --fast_local -C out/Default ${devtools}`,
  );
  expect(() => remoteBuildScript({ argsGn: "", commits: [], ninjaTarget: "chrome;rm" })).toThrow("not safe");
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

test("light modes copy only the listed gen paths", () => {
  const script = copyPathsScript({
    host: "builder",
    source: "/chromium/src",
    destination: "/tmp/chrome-builds/run",
    relativePaths: ["gen/components/neterror/resources/tsc"],
  });

  expect(script).toContain("mkdir -p '/tmp/chrome-builds/run/gen/components/neterror/resources/tsc'");
  expect(script).toContain("builder:/chromium/src/out/Default/gen/components/neterror/resources/tsc/");
  expect(script).toContain("'/tmp/chrome-builds/run/gen/components/neterror/resources/tsc/'");
});

test("the run branch refspec updates only that branch on the builder", () => {
  expect(branchRefspec("dino__haiku__r0")).toBe("+refs/heads/dino__haiku__r0:refs/heads/dino__haiku__r0");
  expect(() => branchRefspec("dino haiku")).toThrow(/branch/);
});
