/**
 * SSRF guard for any server-side outbound fetch driven by user/model input
 * (the fetch_url tool, and search-result page-excerpt fetching). Blocks
 * requests to loopback/private/link-local addresses — including the common
 * cloud metadata endpoint (169.254.169.254) — and resolves hostnames before
 * fetching so a DNS-based bypass (a public hostname that resolves to a
 * private IP) is also caught.
 */
import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "metadata.google.internal"]);

// WHATWG URL.hostname keeps the [] brackets around an IPv6 literal
// (e.g. "http://[::1]/" -> hostname "[::1]"), but net.isIP()/net.isIPv6()
// don't understand that notation and would silently fail to recognize it
// as an IP at all — stripping the brackets first is required for every
// literal-IP check below.
function stripBrackets(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(ipInt, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4_RANGES = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local — includes cloud metadata IP
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function isPrivateIPv4(ip) {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;
  return PRIVATE_V4_RANGES.some(([base, bits]) => inCidr(ipInt, base, bits));
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 address — check the embedded v4 address
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

export function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // unknown shape — fail closed
}

/**
 * Synchronous, structural checks only (protocol/hostname). Cheap first pass
 * before the async DNS-resolving check.
 */
export function isSyntacticallySafeUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const hostname = stripBrackets(url.hostname.toLowerCase());
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  if (net.isIP(hostname) && isPrivateIp(hostname)) return false;
  return true;
}

/**
 * Full check: resolves the hostname and rejects if it (or any redirect
 * target, checked by the caller per-hop) points at a private/loopback/
 * link-local address. Call this immediately before every outbound fetch —
 * do not cache the result across requests, since DNS can change.
 */
export async function isSafeUrlToFetch(urlString) {
  if (!isSyntacticallySafeUrl(urlString)) return false;

  const hostname = stripBrackets(new URL(urlString).hostname);
  if (net.isIP(hostname)) return !isPrivateIp(hostname);

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false; // DNS failure — fail closed, don't fetch
  }
}
