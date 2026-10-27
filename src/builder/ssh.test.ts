import { expect, test } from "bun:test";
import { parseRemoteBuildFile } from "./remote-file";
import { renderSshConfig, withSshInclude } from "./ssh";

const file = parseRemoteBuildFile(`host: builder
hostName: 10.55.0.2
user: omri
identityFile: ~/.ssh/id_ed25519
source: /src
`);

test("renderSshConfig is one Host block", () => {
  expect(renderSshConfig(file)).toBe(`Host builder
  HostName 10.55.0.2
  User omri
  IdentityFile ~/.ssh/id_ed25519
`);
});

test("withSshInclude prepends the Include and does not add it twice", () => {
  const first = withSshInclude({ existing: "Host *\n", includePath: "/repo/configs/builder/ssh_config" });
  const second = withSshInclude({ existing: first.text, includePath: "/repo/configs/builder/ssh_config" });

  expect(first.added).toBe(true);
  expect(first.text).toBe("Include /repo/configs/builder/ssh_config\nHost *\n");
  expect(second.added).toBe(false);
  expect(second.text).toBe(first.text);
});
