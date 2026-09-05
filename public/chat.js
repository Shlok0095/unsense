import {
  renderMarkdownToHtml,
  enhanceRenderedElement,
  createSourceCards,
  createFollowupChips,
  createMessageToolbar,
} from "./render.js";
import {
  clearActiveSession,
  createSession,
  deleteSession,
  branchSession,
  getActiveSessionId,
  getSession,
  listSessions,
  resolveInitialSession,
  searchSessions,
  setActiveSessionId,
  updateSession,
} from "./sessions.js";
import { flattenChunks, addDocuments } from "./documents.js";
import * as memory from "./memory.js";
import { loadSettings, saveSettings } from "./settings.js";
import { listProjects, createProject } from "./projects.js";

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const appRoot = document.getElementById("appRoot");
const chatShell = document.getElementById("chatShell");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarToggleSlot = document.getElementById("sidebarToggleSlot");
const topbarToggleSlot = document.getElementById("topbarToggleSlot");
const sidebarNewChatBtn = document.getElementById("sidebarNewChatBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const historyList = document.getElementById("historyList");
const projectFilterRow = document.getElementById("projectFilterRow");
const chatEl = document.getElementById("chat");
const emptyState = document.getElementById("emptyState");
const emptyStateGreeting = document.getElementById("emptyStateGreeting");
const chatForm = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const thinkToggle = document.getElementById("thinkToggle");
const topNewChatBtn = document.getElementById("topNewChatBtn");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const attachmentList = document.getElementById("attachmentList");
const followupList = document.getElementById("followupList");
const errorBox = document.getElementById("errorBox");
const privacyBadge = document.getElementById("privacyBadge");

const searchOpenBtn = document.getElementById("searchOpenBtn");
const searchOverlay = document.getElementById("searchOverlay");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

const settingsOpenBtn = document.getElementById("settingsOpenBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const settingPrivacyMode = document.getElementById("settingPrivacyMode");
const settingWebSearch = document.getElementById("settingWebSearch");
const settingMemoryEnabled = document.getElementById("settingMemoryEnabled");
const memoryListEl = document.getElementById("memoryList");
const memoryDeleteAllBtn = document.getElementById("memoryDeleteAllBtn");
const aboutHealth = document.getElementById("aboutHealth");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let isGenerating = false;
let chatThread = null;
let activeSession = resolveInitialSession();
let pendingFiles = [];
let activeProjectFilter = null;
let abortController = null;
let settings = loadSettings();

// A "temporary chat" session lives only in memory for this tab — never
// written to localStorage, gone on reload. Distinct from a real session.
let temporarySession = null;

function isThinkEnabled() {
  return thinkToggle.getAttribute("aria-pressed") === "true";
}

function setThinkEnabled(enabled) {
  thinkToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  thinkToggle.title = enabled
    ? "Think on — routes to deep model (code, research, analysis, reasoning)"
    : "Think off — fast responses";
}

const THINK_MODE_LABELS = {
  think: "Deep think",
  research: "Research",
  analyze: "Analysis",
  code: "Code",
};

function thinkLabelForMode(mode) {
  return THINK_MODE_LABELS[mode] || THINK_MODE_LABELS.think;
}

function setHasMessages(hasMessages) {
  chatShell.classList.toggle("has-messages", hasMessages);
}

function isTemporary() {
  return settings.privacyMode === "temporary";
}

function currentSession() {
  return isTemporary() ? temporarySession : activeSession;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
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

function isOverlaySidebar() {
  return window.innerWidth < 1024;
}

function updateBodyScrollLock() {
  const locked =
    (isOverlaySidebar() && !isSidebarCollapsed()) ||
    settingsOverlay.classList.contains("is-open") ||
    searchOverlay.classList.contains("is-open");
  document.body.classList.toggle("scroll-locked", locked);
}

function placeSidebarToggle() {
  const collapsed = isSidebarCollapsed();
  const slot = collapsed ? topbarToggleSlot : sidebarToggleSlot;
  slot.appendChild(sidebarToggle);
  const label = collapsed ? "Open panel" : "Close panel";
  sidebarToggle.title = label;
  sidebarToggle.setAttribute("aria-label", label);
}

function setSidebarCollapsed(collapsed) {
  appRoot.classList.toggle("sidebar-collapsed", collapsed);
  const showOverlay = isOverlaySidebar() && !collapsed;
  sidebarOverlay.classList.toggle("is-visible", showOverlay);
  sidebarOverlay.setAttribute("aria-hidden", showOverlay ? "false" : "true");
  placeSidebarToggle();
  updateBodyScrollLock();
}

function initSidebar() {
  setSidebarCollapsed(isOverlaySidebar());
}

let stickToBottom = true;

function scrollToBottom({ smooth = false, force = false } = {}) {
  if (!force && !stickToBottom) return;
  const distance = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight;
  if (!force && distance > 120) return;
  chatEl.scrollTo({
    top: chatEl.scrollHeight,
    behavior: smooth ? "smooth" : "auto",
  });
}

function bindChatScrollBehavior() {
  chatEl.addEventListener(
    "scroll",
    () => {
      const distance = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight;
      stickToBottom = distance < 96;
    },
    { passive: true }
  );

  // Click handler backup for verified source rows and inline citations.
  chatEl.addEventListener("click", (event) => {
    const anchor = event.target.closest(
      "a.source-link, a.source-list-item, a.citation-link, .msg-assistant a, .msg-assistant-wrap a"
    );
    if (!anchor || !anchor.href || anchor.href.startsWith("javascript:")) return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    window.open(anchor.href, "_blank", "noopener,noreferrer");
  });
}

function keepComposerVisible() {
  if (window.innerWidth >= 768) return;
  window.setTimeout(() => {
    document.querySelector(".composer")?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, 300);
}

function updateNewSessionControls() {
  const hasSessions = listSessions().length > 0;
  topNewChatBtn.classList.toggle("hidden", !hasSessions && !isTemporary());
}

function updatePrivacyBadge() {
  const mode = settings.privacyMode;
  if (mode === "normal") {
    privacyBadge.classList.add("hidden");
    return;
  }
  const labels = {
    temporary: "Temporary — not saved",
    private: "Private — memory off",
    local: "Local model only",
  };
  privacyBadge.textContent = labels[mode] || mode;
  privacyBadge.classList.remove("hidden");
}

function ensureSessionForMessage() {
  if (isTemporary()) {
    if (!temporarySession) {
      temporarySession = {
        id: `tmp_${Date.now()}`,
        title: "temporary session",
        messages: [],
        documents: [],
        conversationSummary: null,
        summarizedThroughCount: 0,
        thinkEnabled: isThinkEnabled(),
        privacyMode: "temporary",
        updatedAt: new Date().toISOString(),
      };
    }
    return temporarySession;
  }
  if (!activeSession) {
    activeSession = createSession({ thinkEnabled: isThinkEnabled(), privacyMode: settings.privacyMode });
    renderHistoryList();
    updateNewSessionControls();
  }
  return activeSession;
}

// ---------------------------------------------------------------------------
// Sidebar / history list (with lightweight project grouping)
// ---------------------------------------------------------------------------
function renderProjectFilterRow() {
  const projects = listProjects();
  projectFilterRow.innerHTML = "";
  if (!projects.length) return;

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `project-chip${activeProjectFilter === null ? " active" : ""}`;
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    activeProjectFilter = null;
    renderProjectFilterRow();
    renderHistoryList();
  });
  projectFilterRow.appendChild(allBtn);

  for (const project of projects) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `project-chip${activeProjectFilter === project.id ? " active" : ""}`;
    chip.textContent = project.name;
    chip.addEventListener("click", () => {
      activeProjectFilter = project.id;
      renderProjectFilterRow();
      renderHistoryList();
    });
    projectFilterRow.appendChild(chip);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "project-chip project-chip-add";
  addBtn.textContent = "+";
  addBtn.title = "New project";
  addBtn.addEventListener("click", () => {
    const name = window.prompt("Project name:");
    if (name && createProject(name)) renderProjectFilterRow();
  });
  projectFilterRow.appendChild(addBtn);
}

function renderHistoryList() {
  const sessions = listSessions().filter(
    (s) => activeProjectFilter === null || s.projectId === activeProjectFilter
  );
  const activeId = currentSession()?.id || "";
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
    btn.textContent = session.hasDocuments ? `📎 ${session.title}` : session.title;
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
  temporarySession = null;
  activeSession = session;
  setActiveSessionId(sessionId);
  syncThinkFromSession(session);
  renderHistoryList();
  renderConversation(session.messages);
  clearError();
  if (window.innerWidth < 1024) setSidebarCollapsed(true);
}

function startNewSession() {
  temporarySession = isTemporary() ? null : temporarySession;
  activeSession = null;
  clearActiveSession();
  clearPendingFiles();
  setThinkEnabled(false);
  renderConversation([]);
  renderHistoryList();
  clearError();
  promptEl.focus();
}

function persistMessages(session, fields) {
  if (isTemporary()) {
    Object.assign(temporarySession, fields);
    return temporarySession;
  }
  if (!session) return null;
  const updated = updateSession(session.id, fields);
  if (updated) activeSession = updated;
  renderHistoryList();
  return updated;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------
function renderAttachmentChips() {
  attachmentList.innerHTML = "";
  const sessionDocs = currentSession()?.documents || [];
  const hasAny = pendingFiles.length || sessionDocs.length;
  attachmentList.classList.toggle("hidden", !hasAny);
  if (!hasAny) return;

  for (const doc of sessionDocs) {
    const chip = document.createElement("div");
    chip.className = "attachment-chip attachment-chip-saved";
    chip.textContent = `📎 ${doc.filename}`;
    attachmentList.appendChild(chip);
  }

  for (const [index, file] of pendingFiles.entries()) {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    const label = document.createElement("span");
    label.className = "attachment-chip-label";
    label.textContent = file.name;
    label.title = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "attachment-chip-remove";
    removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      pendingFiles = pendingFiles.filter((_, i) => i !== index);
      renderAttachmentChips();
    });

    chip.appendChild(label);
    chip.appendChild(removeBtn);
    attachmentList.appendChild(chip);
  }
}

function addPendingFiles(fileList) {
  pendingFiles = [...pendingFiles, ...Array.from(fileList || [])].slice(0, 5);
  renderAttachmentChips();
}

function clearPendingFiles() {
  pendingFiles = [];
  fileInput.value = "";
  renderAttachmentChips();
}

attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  addPendingFiles(fileInput.files);
  fileInput.value = "";
});

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------
function ensureThread() {
  if (!chatThread) {
    chatThread = document.createElement("div");
    chatThread.className = "chat-thread";
    chatEl.appendChild(chatThread);
  }
  return chatThread;
}

function updateEmptyStateGreeting() {
  if (!emptyStateGreeting) return;
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";
  emptyStateGreeting.textContent = greeting;
}

function setEmptyState(visible) {
  emptyState.style.display = visible ? "flex" : "none";
  setHasMessages(!visible);
  if (visible && chatThread) {
    chatThread.remove();
    chatThread = null;
  }
}

function createUserMessageEl(content, index) {
  const wrap = document.createElement("div");
  wrap.className = "msg-user-wrap";
  const col = document.createElement("div");
  col.className = "msg-user-col";

  const bubble = document.createElement("div");
  bubble.className = "msg-user";
  bubble.textContent = content;
  col.appendChild(bubble);

  const toolbar = createMessageToolbar({
    onCopy: () => navigator.clipboard.writeText(content).catch(() => {}),
    onEdit: () => editMessage(index),
  });
  toolbar.classList.add("toolbar-user");
  col.appendChild(toolbar);

  wrap.appendChild(col);
  return wrap;
}

function createAssistantMessageEl(content, meta, index) {
  const wrap = document.createElement("div");
  wrap.className = "msg-assistant-wrap";
  const body = document.createElement("div");
  body.className = "msg-assistant";
  body.innerHTML = renderMarkdownToHtml(content, meta?.sources || []);
  enhanceRenderedElement(body);
  wrap.appendChild(body);

  if (meta?.thinkLabel) {
    const thinkBadge = document.createElement("div");
    thinkBadge.className = "think-mode-badge";
    thinkBadge.textContent = `Think · ${meta.thinkLabel}`;
    wrap.insertBefore(thinkBadge, body);
  }

  const sourceCards = createSourceCards(meta?.sources || []);
  if (sourceCards) wrap.appendChild(sourceCards);

  if (meta?.usedFallback) {
    const badge = document.createElement("div");
    badge.className = "msg-badge";
    badge.textContent = "answered by fallback model";
    wrap.appendChild(badge);
  }
  if (meta?.stopped) {
    const badge = document.createElement("div");
    badge.className = "msg-badge msg-badge-stopped";
    badge.textContent = "stopped by you";
    wrap.appendChild(badge);
  }

  const toolbar = createMessageToolbar({
    onCopy: () => navigator.clipboard.writeText(content).catch(() => {}),
    onRegenerate: () => regenerateFrom(index),
    onBranch: () => doBranch(index),
    onRemember: () => {
      memory.remember(content);
      renderMemoryList();
    },
  });
  wrap.appendChild(toolbar);

  if (meta?.followups?.length) {
    const chips = createFollowupChips(meta.followups, (text) => sendMessage(text));
    wrap.appendChild(chips);
  }

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
    <span class="typing-label">${label}</span>
    <span id="thinkModeChip" class="think-mode-chip hidden" aria-live="polite"></span>
  `;
  return row;
}

function setThinkModeChip(label) {
  const chip = document.getElementById("thinkModeChip");
  if (!chip) return;
  if (!label) {
    chip.classList.add("hidden");
    chip.textContent = "";
    return;
  }
  chip.textContent = label;
  chip.classList.remove("hidden");
}

function setTypingLabel(label) {
  const row = document.getElementById("typingRow");
  const span = row?.querySelector(".typing-label");
  if (span) span.textContent = label;
}

function showTyping(label) {
  hideTyping();
  ensureThread().appendChild(createTypingRow(label));
  scrollToBottom({ force: true, smooth: true });
}

function hideTyping() {
  document.getElementById("typingRow")?.remove();
}

function renderConversation(messages) {
  chatEl.querySelectorAll(".msg-user-wrap, .msg-assistant-wrap, #typingRow, #streamingRow").forEach((el) =>
    el.remove()
  );
  setEmptyState(!messages.length);
  if (!messages.length) return;

  const thread = ensureThread();
  messages.forEach((message, index) => {
    thread.appendChild(
      message.role === "user"
        ? createUserMessageEl(message.content, index)
        : createAssistantMessageEl(message.content, message.meta, index)
    );
  });
  scrollToBottom({ force: true, smooth: true });
}

// ---------------------------------------------------------------------------
// Message actions: edit / regenerate / branch
// ---------------------------------------------------------------------------
function editMessage(index) {
  const session = currentSession();
  if (!session || isGenerating) return;
  const message = session.messages[index];
  if (!message || message.role !== "user") return;

  const truncated = session.messages.slice(0, index);
  persistMessages(session, { messages: truncated });
  renderConversation(truncated);
  promptEl.value = message.content;
  autoResizeTextarea();
  promptEl.focus();
}

function regenerateFrom(index) {
  const session = currentSession();
  if (!session || isGenerating) return;
  // Find the user message preceding this assistant message.
  let userIndex = index - 1;
  while (userIndex >= 0 && session.messages[userIndex].role !== "user") userIndex--;
  if (userIndex < 0) return;

  const userContent = session.messages[userIndex].content;
  const truncated = session.messages.slice(0, userIndex);
  persistMessages(session, { messages: truncated });
  renderConversation(truncated);
  sendMessage(userContent);
}

function doBranch(index) {
  const session = currentSession();
  if (!session || isTemporary()) return; // branching needs real persisted sessions
  const branched = branchSession(session.id, index);
  if (branched) switchSession(branched.id);
}

// ---------------------------------------------------------------------------
// Sending messages (SSE streaming)
// ---------------------------------------------------------------------------
function parseSseChunk(buffer) {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() ?? "";
  const events = [];
  for (const frame of frames) {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        events.push(JSON.parse(line.slice(5).trim()));
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return { events, remainder };
}

async function sendMessage(rawMessage) {
  if (isGenerating) return;
  clearError();

  const message = (rawMessage ?? promptEl.value).trim();
  const files = [...pendingFiles];
  if (!message && !files.length) return;

  const session = ensureSessionForMessage();
  const historyForRequest = session.messages
    .slice(session.summarizedThroughCount || 0)
    .map(({ role, content }) => ({ role, content }));

  const displayMessage = files.length
    ? `${files.map((f) => `📎 ${f.name}`).join("\n")}${message ? `\n\n${message}` : "\n\nAnalyze the attached files."}`
    : message;

  const userMsgIndex = session.messages.length;
  const optimisticMessages = [...session.messages, { role: "user", content: displayMessage }];
  persistMessages(session, { messages: optimisticMessages, thinkEnabled: isThinkEnabled() });
  renderConversation(optimisticMessages);

  if (rawMessage === undefined) {
    promptEl.value = "";
    autoResizeTextarea();
  }
  clearPendingFiles();
  followupList.classList.add("hidden");
  followupList.innerHTML = "";

  if (isOverlaySidebar()) {
    setSidebarCollapsed(true);
  }

  stickToBottom = true;
  isGenerating = true;
  sendBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  attachBtn.disabled = true;
  abortController = new AbortController();
  const thinkUsed = isThinkEnabled();
  showTyping(
    files.length ? "Extracting files..." : thinkUsed ? "Understanding your request..." : "Thinking..."
  );

  // Snapshot of pre-turn state for a clean rollback on failure. Captured
  // before any mutation — for a temporary chat, persistMessages() mutates
  // the session object in place, so `session.messages` itself is not safe
  // to read after that point.
  const originalMessages = session.messages;
  const originalConversationSummary = session.conversationSummary;

  // Hoisted so the catch block can still access whatever streamed in
  // before a failure/abort, and persist it instead of losing it.
  let assistantContent = "";
  let sourcesSoFar = [];
  let streamingEl = null;

  try {
    let newDocuments = [];
    if (files.length) {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const extractRes = await fetch("/api/extract-files", { method: "POST", body: formData });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error || "File extraction failed.");
      newDocuments = extractData.documents || [];
      showTyping(thinkUsed ? "Understanding your request..." : "Thinking...");
    }

    const sessionWithDocs = newDocuments.length
      ? { ...session, documents: addDocuments(session, newDocuments) }
      : session;
    if (newDocuments.length) persistMessages(session, { documents: sessionWithDocs.documents });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        message: message || "Analyze the attached files.",
        mode: "fast",
        think: isThinkEnabled(),
        privacyMode: settings.privacyMode,
        history: historyForRequest,
        conversationSummary: sessionWithDocs.conversationSummary || null,
        documentChunks: flattenChunks(sessionWithDocs),
        memoryEnabled: settings.memoryEnabled,
        memoryItems: settings.memoryEnabled ? memory.toRequestPayload() : [],
        webSearchEnabled: settings.webSearchEnabled,
      }),
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload = null;

    const ensureStreamingEl = () => {
      if (streamingEl) return streamingEl;
      streamingEl = document.createElement("div");
      streamingEl.id = "streamingRow";
      streamingEl.className = "msg-assistant-wrap";
      const body = document.createElement("div");
      body.className = "msg-assistant";
      streamingEl.appendChild(body);
      ensureThread().appendChild(streamingEl);
      scrollToBottom({ force: true, smooth: true });
      return streamingEl;
    };

    let lastRenderAt = 0;
    const renderStreamed = () => {
      const now = performance.now();
      if (now - lastRenderAt < 60) return; // throttle re-renders during fast streaming
      lastRenderAt = now;
      const el = ensureStreamingEl();
      const body = el.querySelector(".msg-assistant");
      body.innerHTML = renderMarkdownToHtml(assistantContent, sourcesSoFar);
      enhanceRenderedElement(body);
      scrollToBottom();
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseChunk(buffer);
      buffer = remainder;

      for (const event of events) {
        if (event.type === "status") {
          setTypingLabel(event.label);
        } else if (event.type === "think_resolved") {
          setTypingLabel(event.status || "Thinking deeply...");
          setThinkModeChip(event.label || thinkLabelForMode(event.mode));
        } else if (event.type === "sources") {
          sourcesSoFar = event.sources;
        } else if (event.type === "delta") {
          hideTyping();
          assistantContent += event.text;
          renderStreamed();
        } else if (event.type === "done") {
          finalPayload = event;
        } else if (event.type === "error") {
          throw Object.assign(new Error(event.error), { status: event.status });
        }
      }
    }

    hideTyping();
    setThinkModeChip(null);
    streamingEl?.remove();

    const finalContent = finalPayload?.content ?? assistantContent;
    const assistantMessage = {
      role: "assistant",
      content: finalContent,
      meta: {
        sources: finalPayload?.sources || sourcesSoFar,
        followups: finalPayload?.followups || [],
        usedFallback: finalPayload?.usedFallback || false,
        provider: finalPayload?.provider,
        model: finalPayload?.model,
        thinkUsed: Boolean(finalPayload?.thinkUsed),
        thinkLabel: finalPayload?.thinkUsed ? thinkLabelForMode(finalPayload?.mode) : null,
      },
    };

    appendRenderedMessage(assistantMessage, userMsgIndex + 1);

    const finalMessages = [...optimisticMessages, assistantMessage];
    const summarizedThroughCount =
      (session.summarizedThroughCount || 0) + (finalPayload?.summarizedCount || 0);
    persistMessages(session, {
      messages: finalMessages,
      conversationSummary: finalPayload?.contextSummary ?? sessionWithDocs.conversationSummary,
      summarizedThroughCount,
    });
  } catch (error) {
    hideTyping();
    setThinkModeChip(null);
    streamingEl?.remove();

    if (error?.name === "AbortError") {
      // User hit Stop — keep whatever streamed in so far as the final
      // answer (marked as stopped) instead of discarding it.
      if (assistantContent.trim()) {
        const partialMessage = {
          role: "assistant",
          content: assistantContent,
          meta: { sources: sourcesSoFar, followups: [], stopped: true },
        };
        appendRenderedMessage(partialMessage, userMsgIndex + 1);
        persistMessages(session, { messages: [...optimisticMessages, partialMessage] });
      } else {
        revertFailedSend(session, originalMessages);
      }
    } else {
      showError(error.message || "Something went wrong.");
      revertFailedSend(session, originalMessages, { conversationSummary: originalConversationSummary });
    }
  } finally {
    isGenerating = false;
    abortController = null;
    sendBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    attachBtn.disabled = false;
  }
}

/** Rolls back an optimistically-added message on failure/no-content-abort.
 * If this was a brand-new session with nothing in it before this attempt,
 * remove it entirely (matches the app's lazy-session-creation model)
 * instead of leaving an empty orphaned session behind in storage. */
function revertFailedSend(session, originalMessages, extraFields = {}) {
  if (!originalMessages.length && !isTemporary()) {
    deleteSession(session.id);
    activeSession = null;
    clearActiveSession();
    renderHistoryList();
    updateNewSessionControls();
    renderConversation([]);
    return;
  }
  persistMessages(session, { messages: originalMessages, ...extraFields });
  renderConversation(originalMessages);
}

function appendRenderedMessage(message, index) {
  setEmptyState(false);
  const thread = ensureThread();
  thread.appendChild(createAssistantMessageEl(message.content, message.meta, index));
  scrollToBottom({ force: true, smooth: true });
}

stopBtn.addEventListener("click", () => {
  abortController?.abort();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

promptEl.addEventListener("input", autoResizeTextarea);
promptEl.addEventListener("focus", keepComposerVisible);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", keepComposerVisible);
}
promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

function autoResizeTextarea() {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 192)}px`;
}

topNewChatBtn.addEventListener("click", startNewSession);
sidebarNewChatBtn.addEventListener("click", startNewSession);

thinkToggle.addEventListener("click", () => {
  setThinkEnabled(!isThinkEnabled());
  const session = currentSession();
  if (session) persistMessages(session, { thinkEnabled: isThinkEnabled() });
});

// ---------------------------------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------------------------------
sidebarToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  setSidebarCollapsed(!isSidebarCollapsed());
});
sidebarOverlay.addEventListener("click", () => setSidebarCollapsed(true));
window.addEventListener("resize", () => {
  if (!isOverlaySidebar()) {
    sidebarOverlay.classList.remove("is-visible");
    sidebarOverlay.setAttribute("aria-hidden", "true");
    updateBodyScrollLock();
    placeSidebarToggle();
    return;
  }
  if (isSidebarCollapsed()) {
    sidebarOverlay.classList.remove("is-visible");
    sidebarOverlay.setAttribute("aria-hidden", "true");
  } else {
    sidebarOverlay.classList.add("is-visible");
    sidebarOverlay.setAttribute("aria-hidden", "false");
  }
  placeSidebarToggle();
  updateBodyScrollLock();
});

// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------
function renderMemoryList() {
  const items = memory.listMemories();
  memoryListEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = "No memories saved yet.";
    memoryListEl.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "memory-item";
    const text = document.createElement("span");
    text.textContent = item.text;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "memory-item-delete";
    del.textContent = "×";
    del.addEventListener("click", () => {
      memory.forget(item.id);
      renderMemoryList();
    });
    row.appendChild(text);
    row.appendChild(del);
    memoryListEl.appendChild(row);
  }
}

function openSettings() {
  settingPrivacyMode.value = settings.privacyMode;
  settingWebSearch.checked = settings.webSearchEnabled;
  settingMemoryEnabled.checked = settings.memoryEnabled;
  renderMemoryList();
  settingsOverlay.classList.add("is-open");
  settingsOverlay.setAttribute("aria-hidden", "false");
  updateBodyScrollLock();
}

function closeSettings() {
  settingsOverlay.classList.remove("is-open");
  settingsOverlay.setAttribute("aria-hidden", "true");
  updateBodyScrollLock();
}

settingsOpenBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) closeSettings();
});

settingPrivacyMode.addEventListener("change", () => {
  settings = saveSettings({ privacyMode: settingPrivacyMode.value });
  updatePrivacyBadge();
  updateNewSessionControls();
});
settingWebSearch.addEventListener("change", () => {
  settings = saveSettings({ webSearchEnabled: settingWebSearch.checked });
});
settingMemoryEnabled.addEventListener("change", () => {
  settings = saveSettings({ memoryEnabled: settingMemoryEnabled.checked });
});
memoryDeleteAllBtn.addEventListener("click", () => {
  if (window.confirm("Delete all saved memories? This cannot be undone.")) {
    memory.deleteAll();
    renderMemoryList();
  }
});

// ---------------------------------------------------------------------------
// Ctrl+K search
// ---------------------------------------------------------------------------
function openSearch() {
  searchOverlay.classList.add("is-open");
  searchOverlay.setAttribute("aria-hidden", "false");
  searchInput.value = "";
  searchResults.innerHTML = "";
  updateBodyScrollLock();
  searchInput.focus();
}

function closeSearch() {
  searchOverlay.classList.remove("is-open");
  searchOverlay.setAttribute("aria-hidden", "true");
  updateBodyScrollLock();
}

searchOpenBtn.addEventListener("click", openSearch);
searchOverlay.addEventListener("click", (event) => {
  if (event.target === searchOverlay) closeSearch();
});

document.addEventListener("keydown", (event) => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  } else if (event.key === "Escape") {
    if (searchOverlay.classList.contains("is-open")) closeSearch();
    else if (settingsOverlay.classList.contains("is-open")) closeSettings();
    else if (isOverlaySidebar() && !isSidebarCollapsed()) setSidebarCollapsed(true);
  }
});

searchInput.addEventListener("input", () => {
  const results = searchSessions(searchInput.value);
  searchResults.innerHTML = "";
  for (const result of results) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "search-result-row";
    row.innerHTML = `<span class="search-result-title">${result.title}</span>${
      result.snippet ? `<span class="search-result-snippet">${result.snippet}</span>` : ""
    }`;
    row.addEventListener("click", () => {
      switchSession(result.id);
      closeSearch();
    });
    searchResults.appendChild(row);
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (!data.ok) {
      showError("API unavailable.");
      aboutHealth.textContent = "API unavailable.";
      return;
    }
    if (!data.hasToken) showError("Server missing HF_TOKEN — set it in Vercel environment variables.");
    if (!data.hasNvidiaKey) {
      // Non-fatal — plain-text PDFs/Office files still work without it.
    }
    aboutHealth.textContent = `Models: ${data.models?.fast || "unknown"} (fast) / ${
      data.models?.deep || "unknown"
    } (deep). Local/Ollama: ${data.hasOllama ? "available" : "not configured"}.`;
  } catch {
    showError("Server offline.");
    aboutHealth.textContent = "Server offline.";
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
syncThinkFromSession(activeSession);
bindChatScrollBehavior();
initSidebar();
updatePrivacyBadge();
updateNewSessionControls();
renderProjectFilterRow();
renderHistoryList();
updateEmptyStateGreeting();
renderConversation(currentSession()?.messages || []);
await checkHealth();
