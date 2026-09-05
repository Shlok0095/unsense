/** Shared "is this error worth retrying on a different model/provider?" rule. */
export function shouldFallback(error) {
  const status = error?.status ?? 0;
  if (status === 429 || status >= 500) return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("model") ||
    message.includes("unavailable") ||
    message.includes("loading") ||
    message.includes("timeout") ||
    message.includes("rate")
  );
}
