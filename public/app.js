import { linkifyBareUrls, shortLinkLabel } from "./linkUtils.js";
import {
  clearActiveSession,
  createSession,
  deleteSession,
  getActiveSessionId,
  getSession,
  listSessions,
  resolveInitialSession,
  setActiveSessionId,
  updateSession,
} from "./sessions.js";

const appRoot = document.getElementById("appRoot");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarClose = document.getElementById("sidebarClose");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const historyList = document.getElementById("historyList");
const chatEl = document.getElementById("chat");
const emptyState = document.getElementById("emptyState");
const chatForm = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const topNewChatBtn = document.getElementById("topNewChatBtn");
const errorBox = document.getElementById("errorBox");

let isGenerating = false;
let chatThread = null;
let activeSession = resolveInitialSession();

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function isSidebarCollapsed() {
  return appRoot.classList.contains("sidebar-collapsed");
}

function setSidebarCollapsed(collapsed) {
  appRoot.classList.toggle("sidebar-collapsed", collapsed);
  const isMobile = window.innerWidth < 768;
  sidebarOverlay.classList.toggle("hidden", collapsed || !isMobile);
}

function initSidebar() {
  setSidebarCollapsed(false);
}

function updateNewSessionControls() {
  const hasSessions = listSessions().length > 0;
  topNewChatBtn.classList.toggle("hidden", !hasSessions);
}

function ensureSessionForMessage() {
  if (!activeSession) {
    activeSession = createSession();
    renderHistoryList();
    updateNewSessionControls();
  }
  return activeSession;
}

sidebarToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (window.innerWidth < 768) {
    setSidebarCollapsed(false);
  } else {
    setSidebarCollapsed(!isSidebarCollapsed());
  }
});

sidebarClose.addEventListener("click", (event) => {
  event.stopPropagation();
  setSidebarCollapsed(true);
});

sidebarOverlay.addEventListener("click", () => {
  setSidebarCollapsed(true);
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) {
    sidebarOverlay.classList.add("hidden");
  }
});

function renderHistoryList() {
  const sessions = listSessions();
  const activeId = activeSession?.id || "";
  historyList.innerHTML = "";

  if (!sessions.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "no sessions yet";
    historyList.appendChild(empty);
    return;
  }

  for (const session of sessions) {
    const row = document.createElement("div");
    row.className = `history-row${session.id === activeId ? " active" : ""}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";
    btn.textContent = session.title;
    btn.title = session.title;
    btn.addEventListener("click", () => switchSession(session.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "history-delete";
    deleteBtn.title = "Delete session";
    deleteBtn.setAttribute("aria-label", "Delete session");
    deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
    deleteBtn.addEventListener("click", (event) => removeSession(session.id, event));

    row.appendChild(btn);
    row.appendChild(deleteBtn);
    historyList.appendChild(row);
  }
}

function removeSession(sessionId, event) {
  event.stopPropagation();

  const deletingActive = activeSession?.id === sessionId;
  deleteSession(sessionId);

  if (deletingActive) {
    activeSession = null;
    clearActiveSession();
    renderConversation([]);
  }

  renderHistoryList();
  updateNewSessionControls();
  clearError();
}

function switchSession(sessionId) {
  const session = getSession(sessionId);
  if (!session) return;
  activeSession = session;
  setActiveSessionId(sessionId);
  renderHistoryList();
  renderConversation(session.messages);
  clearError();
  if (window.innerWidth < 768) {
    setSidebarCollapsed(true);
  }
}

function startNewSession() {
  activeSession = null;
  clearActiveSession();
  renderConversation([]);
  renderHistoryList();
  clearError();
  promptEl.focus();
}

function persistMessages(messages) {
  if (!activeSession) return;
  activeSession = updateSession(activeSession.id, messages) || activeSession;
  renderHistoryList();
}

function ensureThread() {
  if (!chatThread) {
    chatThread = document.createElement("div");
    chatThread.className = "chat-thread";
    chatEl.appendChild(chatThread);
  }
  return chatThread;
}

function configureMarked() {
  if (window.marked) {
    window.marked.setOptions({ breaks: true, gfm: true });
  }
}

function shortenLinksInHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    const text = anchor.textContent?.trim() || "";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    if (href && (text.startsWith("http") || text.length > 48)) {
      anchor.textContent = shortLinkLabel(href, text);
    }
  });
  return doc.body.innerHTML;
}

function renderMarkdown(text) {
  configureMarked();
  const prepared = linkifyBareUrls(text);
  if (window.marked) {
    return shortenLinksInHtml(window.marked.parse(prepared));
  }
  return prepared.replace(/\n/g, "<br>");
}

function createSourceLinks(results = []) {
  if (!results.length) return null;

  const row = document.createElement("div");
  row.className = "source-links";

  const label = document.createElement("span");
  label.className = "source-links-label";
  label.textContent = "sources:";
  row.appendChild(label);

  for (const item of results) {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = item.title || item.url;
    link.textContent = `[${item.id}] ${item.label || shortLinkLabel(item.url, item.title)}`;
    row.appendChild(link);
  }

  return row;
}

function createUserMessage(content) {
  const wrap = document.createElement("div");
  wrap.className = "msg-user-wrap";
  const bubble = document.createElement("div");
  bubble.className = "msg-user";
  bubble.textContent = content;
  wrap.appendChild(bubble);
  return wrap;
}

function createAssistantMessage(content, meta = null) {
  const wrap = document.createElement("div");
  wrap.className = "msg-assistant-wrap";
  const body = document.createElement("div");
  body.className = "msg-assistant";
  body.innerHTML = renderMarkdown(content);

  const sourceLinks = createSourceLinks(meta?.webSearch?.results);
  if (sourceLinks) {
    body.appendChild(sourceLinks);
  }

  wrap.appendChild(body);
  return wrap;
}

function createTypingRow(label = "Thinking...") {
  const row = document.createElement("div");
  row.id = "typingRow";
  row.className = "typing-row";
  row.innerHTML = `
    <span class="typing-dot animate-pulseSlow"></span>
    <span class="typing-dot animate-pulseSlow [animation-delay:150ms]"></span>
    <span class="typing-dot animate-pulseSlow [animation-delay:300ms]"></span>
    <span>${label}</span>
  `;
  return row;
}

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setEmptyState(visible) {
  emptyState.style.display = visible ? "flex" : "none";
  if (visible && chatThread) {
    chatThread.remove();
    chatThread = null;
  }
}

function renderConversation(messages) {
  chatEl.querySelectorAll(".msg-user-wrap, .msg-assistant-wrap, #typingRow").forEach((el) => el.remove());
  setEmptyState(!messages.length);
  if (!messages.length) return;

  const thread = ensureThread();
  for (const message of messages) {
    thread.appendChild(
      message.role === "user"
        ? createUserMessage(message.content)
        : createAssistantMessage(message.content, message.meta)
    );
  }
  scrollToBottom();
}

function appendMessage(role, content, meta = null) {
  setEmptyState(false);
  const thread = ensureThread();
  thread.appendChild(
    role === "user"
      ? createUserMessage(content)
      : createAssistantMessage(content, meta)
  );
  scrollToBottom();
}

function showTyping(label) {
  hideTyping();
  ensureThread().appendChild(createTypingRow(label));
  scrollToBottom();
}

function hideTyping() {
  document.getElementById("typingRow")?.remove();
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (!data.ok) {
      showError("API unavailable.");
      return;
    }
    if (!data.hasToken) {
      showError("Server missing HF_TOKEN — set it in Vercel environment variables.");
    }
  } catch {
    showError("Server offline.");
  }
}

function autoResizeTextarea() {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 192)}px`;
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isGenerating) return;
  clearError();

  const message = promptEl.value.trim();
  if (!message) return;

  ensureSessionForMessage();

  const history = activeSession.messages.map(({ role, content }) => ({ role, content }));

  appendMessage("user", message);
  promptEl.value = "";
  autoResizeTextarea();

  const pendingMessages = [
    ...activeSession.messages,
    { role: "user", content: message },
  ];
  persistMessages(pendingMessages);

  if (window.innerWidth < 768) {
    setSidebarCollapsed(true);
    sidebarOverlay.classList.add("hidden");
  }

  isGenerating = true;
  sendBtn.disabled = true;
  showTyping("Thinking...");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });

    const data = await res.json();
    hideTyping();

    if (!res.ok) throw new Error(data.error || "Request failed");

    const assistantMessage = {
      role: "assistant",
      content: data.content || "(empty response)",
      meta: { webSearch: data.webSearch },
    };

    appendMessage("assistant", assistantMessage.content, assistantMessage.meta);
    persistMessages([...pendingMessages, assistantMessage]);
  } catch (error) {
    hideTyping();
    showError(error.message);
    const reverted = activeSession.messages.slice(0, -1);
    if (reverted.length) {
      persistMessages(reverted);
      renderConversation(reverted);
    } else {
      deleteSession(activeSession.id);
      activeSession = null;
      clearActiveSession();
      renderConversation([]);
      updateNewSessionControls();
    }
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
  }
});

promptEl.addEventListener("input", autoResizeTextarea);

promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

topNewChatBtn.addEventListener("click", startNewSession);

initSidebar();
updateNewSessionControls();
renderHistoryList();
renderConversation(activeSession?.messages || []);
await checkHealth();
