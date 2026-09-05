/**
 * User-facing settings — localStorage only, same trust boundary as
 * sessions/memory. Read once at startup, updated live from the Settings modal.
 */
const STORAGE_KEY = "unsense_settings";

const DEFAULTS = {
  privacyMode: "normal",
  webSearchEnabled: true,
  memoryEnabled: false,
};

export function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
