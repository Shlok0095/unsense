/**
 * Best-effort in-memory rate limiting.
 *
 * IMPORTANT: on Vercel serverless, each warm function instance has its own
 * memory, and instances are ephemeral/scaled horizontally — so this is a
 * soft, per-instance guard against runaway loops and simple abuse, not a
 * hard global limit. It still meaningfully helps (most abusive traffic hits
 * the same warm instance repeatedly) and costs zero infrastructure. If you
 * need a hard global limit, put this behind a shared store (e.g. Upstash
 * Redis) later — the `check()` call site is the only place that would need
 * to change.
 */

const buckets = new Map();
const WINDOW_MS = 60_000;

function getClientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (ip || req.socket?.remoteAddress || "unknown").trim();
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ limit: number, name: string }} opts
 * @returns {{ ok: boolean, retryAfterSec?: number }}
 */
export function checkRateLimit(req, { limit, name }) {
  const key = `${name}:${getClientKey(req)}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  return { ok: true };
}

// Periodically drop stale buckets so memory doesn't grow unbounded on a
// long-lived local/Express process. On serverless this rarely fires, which
// is fine — the instance recycles anyway.
if (typeof setInterval === "function") {
  const timer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [key, entry] of buckets) {
      if (entry.windowStart < cutoff) buckets.delete(key);
    }
  }, WINDOW_MS * 2);
  timer.unref?.();
}
