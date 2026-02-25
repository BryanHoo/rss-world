import 'server-only';
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';

function isAllowedIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  const addr = ipaddr.parse(ip);
  return addr.range() === 'unicast';
}

export async function isSafeExternalUrl(value: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return false;

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname.endsWith('.local')) return false;
  if (hostname === '0.0.0.0') return false;

  if (ipaddr.isValid(hostname)) {
    return isAllowedIp(hostname);
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) return false;
    for (const record of addresses) {
      if (!isAllowedIp(record.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
