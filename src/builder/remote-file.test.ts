import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builderConfig } from "../inspect/build/builder-config";
import { REMOTE_BUILD_EXAMPLE } from "../paths";
import { installSshInclude } from "./install-ssh";
import { parseRemoteBuildFile } from "./remote-file";

const sample = `# build Mac
host: builder
hostName: 10.55.0.2
user: omri
source: /Users/omri/Projects/chromium/src
depotTools: /Users/omri/depot_tools
`;

test("parseRemoteBuildFile rejects the example until the account is filled in", () => {
  const example = readFileSync(REMOTE_BUILD_EXAMPLE, "utf8");

  expect(() => parseRemoteBuildFile(example)).toThrow(/example user/);
  expect(() => parseRemoteBuildFile("host: [")).toThrow(/not valid YAML/);
});

test("parseRemoteBuildFile keeps the connection and the checkout path", () => {
  const file = parseRemoteBuildFile(sample);

  expect(file).toMatchObject({
    host: "builder",
    hostName: "10.55.0.2",
    user: "omri",
    source: "/Users/omri/Projects/chromium/src",
    depotTools: "/Users/omri/depot_tools",
  });
});

test("depotTools is required and must be an absolute path", () => {
  const withoutTools = `host: builder
hostName: 10.55.0.2
user: omri
source: /src
`;
  const relativeTools = `${withoutTools}depotTools: src/depot_tools
`;

  expect(() => parseRemoteBuildFile(withoutTools)).toThrow(/depotTools/);
  expect(() => parseRemoteBuildFile(relativeTools)).toThrow(/absolute path/);
});

test("builderConfig reads a local file and is absent when that file is missing", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-remote-"));
  const missing = join(directory, "nope.yaml");
  const present = join(directory, "remote.yaml");
  writeFileSync(present, sample);

  try {
    expect(builderConfig(missing)).toBeNull();
    expect(builderConfig(present)).toMatchObject({
      host: "builder",
      source: "/Users/omri/Projects/chromium/src",
      depotTools: "/Users/omri/depot_tools",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("installSshInclude writes the fragment and adds the Include once", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-ssh-"));
  const fragmentPath = join(directory, "ssh_config");
  const userSshConfigPath = join(directory, "config");
  writeFileSync(userSshConfigPath, "Host *\n  ForwardAgent no\n");
  const file = parseRemoteBuildFile(sample);

  try {
    const first = installSshInclude({ file, fragmentPath, userSshConfigPath });
    const text = readFileSync(userSshConfigPath, "utf8");
    const second = installSshInclude({ file, fragmentPath, userSshConfigPath });

    expect(first.addedInclude).toBe(true);
    expect(second.addedInclude).toBe(false);
    expect(text.startsWith(`Include ${fragmentPath}\n`)).toBe(true);
    expect(text).toContain("Host *");
    expect(readFileSync(fragmentPath, "utf8")).toContain("HostName 10.55.0.2");
    expect(readFileSync(userSshConfigPath, "utf8")).toBe(text);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
