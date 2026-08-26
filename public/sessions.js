const STORAGE_KEY = "unsense_sessions";
const ACTIVE_KEY = "unsense_active_session";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
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
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
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

export function createSession() {
  const session = {
    id: `sess_${Date.now()}`,
    title: "new session",
    messages: [],
    updatedAt: new Date().toISOString(),
  };
  const sessions = loadAll();
  sessions.unshift(session);
  saveAll(sessions);
  setActiveSessionId(session.id);
  return session;
}

export function ensureActiveSession() {
  const activeId = getActiveSessionId();
  if (activeId) {
    const existing = getSession(activeId);
    if (existing) return existing;
    clearActiveSession();
  }

  const sessions = loadAll();
  if (sessions.length) {
    setActiveSessionId(sessions[0].id);
    return sessions[0];
  }

  return null;
}

export function updateSession(id, messages) {
  const sessions = loadAll();
  const index = sessions.findIndex((session) => session.id === id);
  if (index === -1) return null;

  sessions[index] = {
    ...sessions[index],
    messages,
    title: makeTitle(messages),
    updatedAt: new Date().toISOString(),
  };
  saveAll(sessions);
  return sessions[index];
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
