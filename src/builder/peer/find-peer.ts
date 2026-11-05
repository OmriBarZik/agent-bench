import { join } from "node:path";
import { BENCH_DIR } from "../../paths";
import { deviceForConnection, ownAddresses, peerAddresses } from "./peer-address";

/** Script ssh runs as the ProxyCommand when remote.yaml names a connection. */
export const PEER_PROXY_SCRIPT = join(BENCH_DIR, "src/builder/peer/peer-proxy.ts");

/** The BSD device behind a connection name such as "Thunderbolt Bridge". Throws when this Mac has no such port. */
export function resolveConnection(name: string): string {
  const hardwarePorts = runText(["networksetup", "-listallhardwareports"]);
  const device = deviceForConnection({ hardwarePorts, name });

  if (device == null) {
    throw new Error(`this Mac has no network connection named "${name}"; see networksetup -listallhardwareports`);
  }

  return device;
}

/**
 * The one other machine on `device`, found by pinging the IPv6 all-nodes address.
 * Throws when nobody answers, or when more than one machine does.
 */
export function findPeer(device: string): string {
  const own = ownAddresses(runText(["ifconfig", device]));
  const pingOutput = runText(["ping6", "-c", "2", "-I", device, "ff02::1"]);
  const peers = peerAddresses({ pingOutput, device, own });

  if (peers.length === 0) {
    throw new Error(`no other machine answered on ${device}; check the cable and that the build Mac is awake`);
  }

  if (peers.length > 1) {
    throw new Error(`${peers.length} machines answered on ${device} (${peers.join(", ")}); set hostName instead`);
  }

  return peers[0] as string;
}

/** The ssh_config ProxyCommand that finds the peer on `device` each time ssh connects. */
export function peerProxyCommand(device: string): string {
  // Prefer the PATH entry (e.g. /opt/homebrew/bin/bun): execPath is a versioned Cellar path that an upgrade removes.
  const parts = [Bun.which("bun") ?? process.execPath, PEER_PROXY_SCRIPT, device];

  for (const part of parts) {
    if (/[\s%]/.test(part)) {
      throw new Error(`ProxyCommand cannot use ${part} because it has a space or %`);
    }
  }

  return `${parts.join(" ")} %p`;
}

function runText(command: string[]): string {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });

  // ping6 exits non-zero when some probes get no reply, and its output still lists who answered.
  if (!result.success && command[0] !== "ping6") {
    throw new Error(`${command.join(" ")} failed: ${result.stderr.toString().trim()}`);
  }

  return result.stdout.toString();
}
