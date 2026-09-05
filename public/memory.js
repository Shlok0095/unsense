/**
 * Long-term memory — entirely user-curated and entirely local (localStorage).
 * Nothing is inferred or saved automatically: a fact only enters memory when
 * the user explicitly chooses "Remember this" on a message, or adds one in
 * Settings. This is a deliberate, conservative design choice (see the
 * project README) — it avoids silently deciding what's "important" and
 * keeps the whole feature trivially inspectable/deletable by the user.
 */
const STORAGE_KEY = "unsense_memory";

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listMemories() {
  return load().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function remember(text) {
  const clean = String(text || "").trim().slice(0, 500);
  if (!clean) return null;

  const items = load();
  // Avoid exact-duplicate clutter.
  if (items.some((m) => m.text === clean)) return null;

  const item = { id: `mem_${Date.now()}`, text: clean, createdAt: new Date().toISOString() };
  items.unshift(item);
  save(items);
  return item;
}

export function updateMemory(id, text) {
  const items = load();
  const index = items.findIndex((m) => m.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], text: String(text || "").trim().slice(0, 500) };
  save(items);
  return items[index];
}

export function forget(id) {
  save(load().filter((m) => m.id !== id));
}

export function deleteAll() {
  save([]);
}

/** Shape expected by /api/chat's memoryItems field. */
export function toRequestPayload() {
  return listMemories().map(({ id, text }) => ({ id, text }));
}
