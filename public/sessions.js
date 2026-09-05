/**
 * Session (conversation) storage — browser localStorage only, per the
 * app's zero-server-persistence design. Schema is versioned so an older
 * saved format can be migrated forward without ever silently discarding a
 * user's chat history.
 */
const STORAGE_KEY = "unsense_sessions";
const ACTIVE_KEY = "unsense_active_session";
const SCHEMA_VERSION = 2;

function emptySessionFields() {
  return {
    projectId: null,
    thinkEnabled: false,
    privacyMode: "normal",
    conversationSummary: null,
    summarizedThroughCount: 0,
    documents: [],
  };
}

function migrateSession(raw) {
  const thinkEnabled =
    raw.thinkEnabled === true ||
    (raw.thinkEnabled === undefined && raw.mode && raw.mode !== "fast");
  return {
    id: raw.id,
    title: raw.title || "new session",
    updatedAt: raw.updatedAt || new Date().toISOString(),
    ...emptySessionFields(),
    ...raw,
    thinkEnabled,
    messages: (raw.messages || []).map(migrateMessage),
  };
}

function migrateMessage(msg) {
  if (!msg || typeof msg !== "object") return msg;
  // v1 assistant messages nested search results under meta.webSearch.results —
  // the new renderer reads meta.sources / meta.followups directly.
  if (msg.meta?.webSearch && !msg.meta.sources) {
    return {
      ...msg,
      meta: {
        ...msg.meta,
        sources: msg.meta.webSearch.results || [],
      },
    };
  }
  return msg;
}

function loadRaw() {
  const text = localStorage.getItem(STORAGE_KEY);
  if (!text) return { version: SCHEMA_VERSION, sessions: [] };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    backupCorrupt(text);
    return { version: SCHEMA_VERSION, sessions: [] };
  }

  // v1 stored a bare array with no version wrapper.
  if (Array.isArray(parsed)) {
    return { version: SCHEMA_VERSION, sessions: parsed.map(migrateSession) };
  }
  if (parsed && Array.isArray(parsed.sessions)) {
    if (parsed.version === SCHEMA_VERSION) return parsed;
    return { version: SCHEMA_VERSION, sessions: parsed.sessions.map(migrateSession) };
  }

  backupCorrupt(text);
  return { version: SCHEMA_VERSION, sessions: [] };
}

function backupCorrupt(text) {
  try {
    const key = `unsense_sessions_backup_${Date.now()}`;
    localStorage.setItem(key, text);
    console.warn(
      `[sessions] Saved chat data could not be read and was preserved as a backup under "${key}" instead of being deleted. Starting with an empty session list.`
    );
  } catch {
    /* localStorage full/unavailable — nothing more we can do */
  }
}

function loadAll() {
  return loadRaw().sessions;
}

function saveAll(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, sessions }));
}

function makeTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "new session";
  const text = firstUser.content.trim();
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

export function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_KEY) || "";
}

export function setActiveSessionId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function listSessions() {
  return loadAll()
    .filter((session) => session.messages?.length > 0)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(({ id, title, updatedAt, projectId, documents }) => ({
      id,
      title,
      updatedAt,
      projectId,
      hasDocuments: Boolean(documents?.length),
    }));
}

export function getSession(id) {
  return loadAll().find((session) => session.id === id) || null;
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function resolveInitialSession() {
  const activeId = getActiveSessionId();
  if (!activeId) return null;

  const session = getSession(activeId);
  if (session) return session;

  clearActiveSession();
  return null;
}

export function createSession({ thinkEnabled = false, privacyMode = "normal", projectId = null } = {}) {
  const session = {
    id: `sess_${Date.now()}`,
    title: "new session",
    messages: [],
    updatedAt: new Date().toISOString(),
    ...emptySessionFields(),
    thinkEnabled,
    privacyMode,
    projectId,
  };
  const sessions = loadAll();
  sessions.unshift(session);
  saveAll(sessions);
  setActiveSessionId(session.id);
  return session;
}

export function updateSession(id, fields) {
  const sessions = loadAll();
  const index = sessions.findIndex((session) => session.id === id);
  if (index === -1) return null;

  const next = { ...sessions[index], ...fields, updatedAt: new Date().toISOString() };
  if (fields.messages) next.title = makeTitle(fields.messages);
  sessions[index] = next;
  saveAll(sessions);
  return next;
}

export function deleteSession(id) {
  const sessions = loadAll().filter((session) => session.id !== id);
  saveAll(sessions);
  if (getActiveSessionId() === id) {
    if (sessions.length) {
      setActiveSessionId(sessions[0].id);
    } else {
      clearActiveSession();
    }
  }
  return sessions;
}

/** Creates a copy of a session up to (and including) a given message index —
 * used for "branch from here". The branch is independent: editing it never
 * touches the original conversation. */
export function branchSession(sourceId, uptoMessageIndex) {
  const source = getSession(sourceId);
  if (!source) return null;

  const branched = {
    ...source,
    id: `sess_${Date.now()}`,
    title: `${source.title} (branch)`,
    messages: source.messages.slice(0, uptoMessageIndex + 1),
    updatedAt: new Date().toISOString(),
  };
  const sessions = loadAll();
  sessions.unshift(branched);
  saveAll(sessions);
  setActiveSessionId(branched.id);
  return branched;
}

/** Full-text search across session titles and message content. */
export function searchSessions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results = [];
  for (const session of loadAll()) {
    if (!session.messages?.length) continue;
    const titleMatch = session.title.toLowerCase().includes(q);
    const matchedMessages = session.messages.filter((m) => m.content?.toLowerCase().includes(q));
    if (titleMatch || matchedMessages.length) {
      results.push({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        snippet: matchedMessages[0]?.content?.slice(0, 120) || "",
      });
    }
  }
  return results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 30);
}
