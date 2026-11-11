import { expect, test } from "bun:test";
import { parseRemoteBuildFile } from "../remote-file";
import { renderSshConfig } from "../ssh";
import { peerProxyCommand } from "./find-peer";
import { deviceForConnection, ownAddresses, peerAddresses } from "./peer-address";

const ifconfig = `bridge0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	inet6 fe80::1400:132:cfd5:b553%bridge0 prefixlen 64 secured scopeid 0xf
	inet 169.254.202.56 netmask 0xffff0000 broadcast 169.254.255.255
`;

const ping = `PING6(56=40+8+8 bytes) fe80::1400:132:cfd5:b553%bridge0 --> ff02::1
16 bytes from fe80::1400:132:cfd5:b553%bridge0, icmp_seq=0 hlim=64 time=0.151 ms
16 bytes from fe80::83f:f10:f0b5:eb0b%bridge0, icmp_seq=0 hlim=64 time=0.927 ms
16 bytes from fe80::1400:132:cfd5:b553%bridge0, icmp_seq=1 hlim=64 time=0.282 ms
16 bytes from fe80::83f:f10:f0b5:eb0b%bridge0, icmp_seq=1 hlim=64 time=0.401 ms
`;

const hardwarePorts = `Hardware Port: Wi-Fi
Device: en0
Ethernet Address: aa:bb:cc:dd:ee:ff

Hardware Port: Thunderbolt Bridge
Device: bridge0
Ethernet Address: 36:8b:2a:a4:13:c0
`;

test("peerAddresses drops this Mac's own replies and lists the other machine once", () => {
  const own = ownAddresses(ifconfig);

  expect(own).toEqual(["fe80::1400:132:cfd5:b553"]);
  expect(peerAddresses({ pingOutput: ping, device: "bridge0", own })).toEqual(["fe80::83f:f10:f0b5:eb0b%bridge0"]);
});

test("deviceForConnection accepts the port name or the device, in any case", () => {
  expect(deviceForConnection({ hardwarePorts, name: "Thunderbolt Bridge" })).toBe("bridge0");
  expect(deviceForConnection({ hardwarePorts, name: "thunderbolt bridge" })).toBe("bridge0");
  expect(deviceForConnection({ hardwarePorts, name: "bridge0" })).toBe("bridge0");
  expect(deviceForConnection({ hardwarePorts, name: "Ethernet" })).toBeNull();
});

test("remote.yaml takes a connection, a hostName, or both, and not neither", () => {
  const base = `host: builder
user: mock-user
source: /src
depotTools: /depot_tools
`;
  const file = parseRemoteBuildFile(`${base}connection: Thunderbolt Bridge\n`);

  expect(file.connection).toBe("Thunderbolt Bridge");
  expect(renderSshConfig({ file, proxyCommand: "/bun /peer-proxy.ts bridge0 %p" })).toBe(`Host builder
  ProxyCommand /bun /peer-proxy.ts bridge0 %p
  User mock-user
`);
  expect(() => parseRemoteBuildFile(base)).toThrow(/needs a hostName/);

  const both = parseRemoteBuildFile(`${base}hostName: 10.0.0.2\nconnection: bridge0\n`);

  expect(both.hostName).toBe("10.0.0.2");
  expect(both.connection).toBe("bridge0");
  expect(peerProxyCommand({ device: "bridge0", fallbackHost: "10.0.0.2" })).toEndWith("bridge0 %p 10.0.0.2");
  expect(peerProxyCommand({ device: "bridge0" })).toEndWith("bridge0 %p");
  expect(() => peerProxyCommand({ device: "bridge0", fallbackHost: "bad host" })).toThrow(/space or %/);
});
