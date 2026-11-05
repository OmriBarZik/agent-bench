import type { PeerReplies } from "./peer-address.types";

/** IPv6 addresses an interface holds, without the `%device` zone, from `ifconfig <device>` output. */
export function ownAddresses(ifconfigOutput: string): string[] {
  const addresses: string[] = [];

  for (const line of ifconfigOutput.split("\n")) {
    const match = /^\s*inet6\s+([0-9a-f:]+)/i.exec(line);

    if (match?.[1]) {
      addresses.push(match[1].toLowerCase());
    }
  }

  return addresses;
}

/**
 * The other machines that answered a ping to ff02::1, as `fe80::…%device`.
 * Replies from this Mac's own addresses are dropped, and each machine is listed once.
 */
export function peerAddresses({ pingOutput, device, own }: PeerReplies): string[] {
  const peers = new Set<string>();

  for (const line of pingOutput.split("\n")) {
    const match = /bytes from ([0-9a-f:]+)(%\S+?)?,/i.exec(line);
    const address = match?.[1]?.toLowerCase();

    if (address == null || own.includes(address)) {
      continue;
    }

    peers.add(`${address}%${device}`);
  }

  return [...peers];
}

/**
 * The BSD device for a connection name, from `networksetup -listallhardwareports` output.
 * `name` may be the port name ("Thunderbolt Bridge") or the device itself ("bridge0"). Case does not matter.
 */
export function deviceForConnection({ hardwarePorts, name }: { hardwarePorts: string; name: string }): string | null {
  const wanted = name.toLowerCase();
  let port: string | null = null;

  for (const line of hardwarePorts.split("\n")) {
    const portMatch = /^Hardware Port:\s*(.+)$/.exec(line.trim());

    if (portMatch?.[1]) {
      port = portMatch[1].trim().toLowerCase();
      continue;
    }

    const deviceMatch = /^Device:\s*(\S+)$/.exec(line.trim());

    if (deviceMatch?.[1] && (port === wanted || deviceMatch[1].toLowerCase() === wanted)) {
      return deviceMatch[1];
    }
  }

  return null;
}
