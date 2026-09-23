import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const denied = new BlockList();
for (const [network, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) denied.addSubnet(network, prefix);
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");

const pages = ["teams.microsoft.com", "teams.live.com", "teams.cloud.microsoft"];
// Deliberately narrow first slice. Unknown CDN/tenant endpoints fail closed.
const resources = [...pages, "teams.cdn.office.net", "res.cdn.office.net", "skype.com", "lync.com"];
export function approvedUrl(input: string, navigation = false, websocket = false): boolean {
  try {
    const url = new URL(input);
    if (url.protocol !== (websocket ? "wss:" : "https:") || url.username || url.password || url.port || isIP(url.hostname)) return false;
    return (navigation ? pages : resources).some(host => url.hostname === host || (!navigation && url.hostname.endsWith(`.${host}`)));
  } catch { return false; }
}

export async function approvedDestination(input: string, navigation = false, websocket = false): Promise<boolean> {
  if (!approvedUrl(input, navigation, websocket)) return false;
  try {
    const addresses = await lookup(new URL(input).hostname, { all: true });
    return addresses.length > 0 && addresses.every(({ address, family }) => family === 4
      ? !denied.check(address, "ipv4") : publicV6.check(address, "ipv6") && !address.toLowerCase().startsWith("2001:db8:"));
  } catch { return false; }
}

// DNS preflight is defense in depth, not an egress firewall: the browser resolves
// again, and WebRTC UDP bypasses HTTP routes. Real runs require a worker network
// namespace/firewall excluding private/metadata destinations and non-platform egress.
