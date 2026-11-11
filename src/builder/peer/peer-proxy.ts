#!/usr/bin/env bun
import { findPeer } from "./find-peer";

/**
 * SSH ProxyCommand for a build Mac named by its connection instead of an address.
 *
 *   ProxyCommand bun src/builder/peer/peer-proxy.ts <device> %p [fallback-host]
 *
 * Finds the one other machine on <device> (such as bridge0) and connects ssh to it with nc.
 * When nobody answers there and remote.yaml also has a hostName, connects to that address instead,
 * so the build Mac is reached over Wi-Fi while the cable is out.
 * setup:remote-build writes this line into configs/builder/ssh_config.
 */
async function main(): Promise<void> {
  const [device, port, fallbackHost] = Bun.argv.slice(2);

  if (!device || !port) {
    throw new Error("usage: peer-proxy.ts <device> <port> [fallback-host]");
  }

  const address = peerOrFallback({ device, fallbackHost });
  const tunnel = Bun.spawn(["nc", address, port], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  process.exit(await tunnel.exited);
}

function peerOrFallback({ device, fallbackHost }: { device: string; fallbackHost?: string }): string {
  try {
    return findPeer(device);
  } catch (error) {
    if (!fallbackHost) {
      throw error;
    }

    // ssh shows this line, so a build log says which link it used.
    console.error(`${error instanceof Error ? error.message : error}; using ${fallbackHost} instead`);

    return fallbackHost;
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
