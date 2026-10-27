#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { installSshInclude } from "../../builder/install-ssh";
import { parseRemoteBuildFile } from "../../builder/remote-file";
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
 * Run it again after changing remote.yaml.
 */
async function main(): Promise<void> {
  if (!existsSync(REMOTE_BUILD_FILE)) {
    await Bun.write(REMOTE_BUILD_FILE, await Bun.file(REMOTE_BUILD_EXAMPLE).text());

    throw new Error(`Wrote ${REMOTE_BUILD_FILE}. Fill in the build Mac, then run bun run setup:remote-build again.`);
  }

  const file = parseRemoteBuildFile(await Bun.file(REMOTE_BUILD_FILE).text());
  const installed = installSshInclude({
    file,
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

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
