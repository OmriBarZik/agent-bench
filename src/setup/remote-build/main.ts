#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { installSshInclude } from "../../builder/install-ssh";
import { answersSsh, findPeer, peerProxyCommand, resolveConnection } from "../../builder/peer/find-peer";
import { parseRemoteBuildFile } from "../../builder/remote-file";
import type { RemoteBuildFile } from "../../builder/remote-file.types";
import { renderSshConfig } from "../../builder/ssh";
import { REMOTE_BUILD_EXAMPLE, REMOTE_BUILD_FILE, REMOTE_SSH_CONFIG } from "../../paths";

/**
 * Points ~/.ssh/config at this repo's build-Mac connection file.
 *
 *   bun run setup:remote-build
 *
 * The first run copies configs/builder/remote.yaml.example to configs/builder/remote.yaml
 * when that file is missing, and stops so you can fill in the address, account, and paths.
 * The next run writes configs/builder/ssh_config from that file and adds
 * `Include <that path>` to the top of ~/.ssh/config. Both written files are gitignored.
 * When remote.yaml names a `connection`, the Host block gets a ProxyCommand that finds the build Mac
 * on that connection each time ssh connects. With a `hostName` as well, ssh uses that address when the
 * connection has no build Mac on it, and setup says whether that address answers now.
 * Run it again after changing remote.yaml.
 */
async function main(): Promise<void> {
  if (!existsSync(REMOTE_BUILD_FILE)) {
    await Bun.write(REMOTE_BUILD_FILE, await Bun.file(REMOTE_BUILD_EXAMPLE).text());

    throw new Error(`Wrote ${REMOTE_BUILD_FILE}. Fill in the build Mac, then run bun run setup:remote-build again.`);
  }

  const file = parseRemoteBuildFile(await Bun.file(REMOTE_BUILD_FILE).text());
  const installed = installSshInclude({
    fragment: renderSshConfig({ file, proxyCommand: proxyFor(file) }),
    fragmentPath: REMOTE_SSH_CONFIG,
    userSshConfigPath: join(homedir(), ".ssh", "config"),
  });
  console.log(`Wrote ${installed.fragmentPath}`);

  if (installed.addedInclude) {
    console.log(`Added Include to ${installed.userSshConfigPath}`);

    return;
  }

  console.log(`${installed.userSshConfigPath} already includes it`);
}

function proxyFor(file: RemoteBuildFile): string | undefined {
  if (file.connection == null) {
    return undefined;
  }

  const device = resolveConnection(file.connection);
  console.log(`${file.connection} is ${device}`);

  try {
    console.log(`The build Mac answers at ${findPeer(device)}`);
  } catch (error) {
    // A missing cable now should not stop setup; ssh looks again on every connect.
    console.warn(`Warning: ${error instanceof Error ? error.message : error}`);
  }

  if (file.hostName != null) {
    if (answersSsh(file.hostName)) {
      console.log(`Without ${file.connection}, the build Mac answers at ${file.hostName}`);
    } else {
      console.warn(`Warning: ${file.hostName} does not answer on the SSH port, so builds need ${file.connection}`);
    }
  }

  return peerProxyCommand({ device, fallbackHost: file.hostName });
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
