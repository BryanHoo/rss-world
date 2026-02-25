import 'server-only';
import ipaddr from 'ipaddr.js';

function isUnicastIp(hostname: string): boolean {
  if (!ipaddr.isValid(hostname)) return false;
  const addr = ipaddr.parse(hostname);
  return addr.range() === 'unicast';
}

export function isSafeExternalUrl(value: string): boolean {
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
    return isUnicastIp(hostname);
  }

  return true;
}

