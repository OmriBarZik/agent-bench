#!/usr/bin/env bun
import { findPeer } from "./find-peer";

/**
 * SSH ProxyCommand for a build Mac named by its connection instead of an address.
 *
 *   ProxyCommand bun src/builder/peer/peer-proxy.ts <device> %p
 *
 * Finds the one other machine on <device> (such as bridge0) and connects ssh to it with nc.
 * setup:remote-build writes this line into configs/builder/ssh_config.
 */
async function main(): Promise<void> {
  const [device, port] = Bun.argv.slice(2);

  if (!device || !port) {
    throw new Error("usage: peer-proxy.ts <device> <port>");
  }

  const address = findPeer(device);
  const tunnel = Bun.spawn(["nc", address, port], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  process.exit(await tunnel.exited);
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
