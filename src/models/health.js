/**
 * In-memory model/provider health tracking.
 *
 * Same caveat as rateLimit.js: this is per warm serverless instance, not a
 * global source of truth. It still does real work — it stops a single
 * instance from hammering a model that just failed, and the /api/health
 * endpoint surfaces it for visibility. A short cooldown, not a permanent
 * ban, so a model recovers automatically.
 */

const COOLDOWN_MS = 60_000;
const FAILURE_THRESHOLD = 3;

const state = new Map(); // key -> { failures, cooldownUntil, lastError, lastCheckedAt }

function key(provider, model) {
  return `${provider}::${model}`;
}

export function recordSuccess(provider, model) {
  state.set(key(provider, model), {
    failures: 0,
    cooldownUntil: 0,
    lastError: null,
    lastCheckedAt: Date.now(),
  });
}

export function recordFailure(provider, model, error) {
  const k = key(provider, model);
  const entry = state.get(k) || { failures: 0, cooldownUntil: 0 };
  entry.failures += 1;
  entry.lastError = error?.message || String(error || "unknown error");
  entry.lastCheckedAt = Date.now();
  if (entry.failures >= FAILURE_THRESHOLD) {
    entry.cooldownUntil = Date.now() + COOLDOWN_MS;
  }
  state.set(k, entry);
}

export function isHealthy(provider, model) {
  const entry = state.get(key(provider, model));
  if (!entry) return true;
  return Date.now() >= entry.cooldownUntil;
}

/** Test-only utility — clears all tracked state between test cases. */
export function _resetHealthForTests() {
  state.clear();
}

export function getHealthSnapshot() {
  const out = {};
  for (const [k, v] of state) {
    out[k] = {
      healthy: Date.now() >= v.cooldownUntil,
      failures: v.failures,
      lastError: v.lastError,
      lastCheckedAt: v.lastCheckedAt ? new Date(v.lastCheckedAt).toISOString() : null,
    };
  }
  return out;
}
