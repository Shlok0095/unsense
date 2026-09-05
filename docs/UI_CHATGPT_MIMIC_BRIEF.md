# unsensoredgpt — ChatGPT Layout Mimic Brief

> Authoritative spec for ChatGPT-style layout behavior with a restrained futuristic
> hacker aesthetic. Mimics interaction patterns, not ChatGPT's exact colors.

---

## Vision

Match ChatGPT's **layout choreography** — centered welcome composer, bottom-docked
active chat, sidebar header icon cluster, inline Think toggle — while keeping
unsensoredgpt's identity: obsidian canvas, muted ice accents, monospace hints,
subtle scan-line texture. No bright blues, no cheap neon.

---

## Aesthetic (futuristic hacker, restrained)

| Token | Value | Use |
|-------|-------|-----|
| `--bg-base` | `#0a0c0f` | Deep void canvas |
| `--bg-sidebar` | `#0f1218` | Sidebar rail |
| `--bg-elevated` | `#1a1f28` | Composer pill |
| `--accent-ice` | `#6b9eb8` | Muted steel-cyan (not ChatGPT blue) |
| `--accent-glow` | `rgba(107, 158, 184, 0.08)` | Think active state |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Hairline edges |
| `--text-primary` | `#d4d8de` | Body text |
| `--text-muted` | `#5c6570` | Labels |

- Typography: Space Grotesk UI, Instrument Serif greeting, JetBrains Mono for kbd/status
- Think toggle active: subtle border + faint inner glow, not saturated fill
- No native `<select>` in composer — eliminates OS dropdown white box

---

## Layout: empty vs active chat

```
EMPTY (no messages):
┌─────────────────────────────────────┐
│ topbar (minimal)                    │
│                                     │
│         Good evening                │
│   What can I help you with today?   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ +  Message...    Think  ↑  │   │  ← centered vertically
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

ACTIVE (has messages):
┌─────────────────────────────────────┐
│ topbar                              │
│  [user bubble]                      │
│  assistant response                 │
│  ...scroll...                       │
│ ┌─────────────────────────────────┐ │
│ │ +  Message...      Think  ↑    │ │  ← sticky bottom
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Implementation:**
- `.chat-shell` toggles `.has-messages` when `messages.length > 0`
- `.chat-body` wraps `chat-main` + `.composer`
- Empty: `.chat-body { flex:1; justify-content:center; gap:2rem }`
- Active: composer `sticky bottom-0` with gradient fade

---

## Sidebar

```
┌──────────────────────┐
│ unsensoredgpt  🔍 ⊟  │  ← brand left, search + collapse right
├──────────────────────┤
│ ✎ New chat           │  ← full-width row
├──────────────────────┤
│ [session history]    │
├──────────────────────┤
│ ⚙ Settings           │
└──────────────────────┘
```

- Remove full-width "Search" toolbar row
- `sidebarNewChatBtn` triggers `startNewSession()`
- Collapse icon: panel-close (not chevron alone in wrong place)

---

## Composer

- **Left:** `+` attach
- **Center:** auto-growing textarea, no inner border on focus
- **Right:** Think pill toggle + circular send
- **Focus:** single subtle border change on `.composer-pill:focus-within` — no double ring
- **Default mode:** always `fast` in API
- **Think on:** sends `think: true`; backend resolves mode via heuristics + cheap LLM

---

## Think mode flow

1. User toggles Think → `aria-pressed="true"`
2. POST `/api/chat` with `{ mode: "fast", think: true }`
3. `modeResolver.js` classifies → `code` | `analyze` | `research` | `think` | `fast`
4. SSE status: "Coding...", "Analyzing...", "Researching...", "Thinking deeply..."
5. Orchestrator uses resolved mode for prompts + model tier

---

## Settings cleanup

- Remove "Default response mode" dropdown (always fast)
- Sessions store `thinkEnabled` instead of `mode`
