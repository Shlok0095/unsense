# unsensoredgpt — Standard Chat Layout Brief

> Authoritative design spec for the ChatGPT / Claude-style UI refactor. Prioritizes clarity, sort order, and premium minimal dark mode over sci-fi decoration.

---

## Research Insights (applied)

1. **Converged layout pattern** — Major AI chat UIs share the same skeleton: left session rail, center message stream capped at ~720–768px, bottom composer. Differentiation comes from typography and restraint, not novel layout.
2. **Docked composer with padding** — The message stream needs bottom padding equal to composer height + safe area so the last message is never obscured. Composer sits at the bottom of the viewport; on mobile the keyboard pushes it up without overlap bugs.
3. **Centered column mechanics** — Inside a flex column, the thread uses `width: 100%`, `max-width: 48rem`, and `margin-inline: auto` so the column expands on narrow viewports but stays readable on desktop.

---

## Vision

A **sorted, standard chat app** that feels like ChatGPT or Claude: one cohesive dark canvas, quiet sidebar, readable centered thread, floating pill composer, generous negative space. Keep subtle ice accent from the prior redesign; remove glass overload, grid orbs, and heavy borders that fight readability.

---

## Layout Grid

```
┌─────────────────────────────────────────────────────────────┐
│  viewport: 100dvh, overflow hidden                          │
│  ┌──────────┬──────────────────────────────────────────────┐│
│  │ sidebar  │  chat-shell (flex column, min-h-0)           ││
│  │ 16rem    │  ┌ topbar (shrink-0, minimal) ────────────┐ ││
│  │ fixed    │  ├ chat-main (flex-1, overflow-y auto) ────┤ ││
│  │ overlay  │  │   empty-state OR chat-thread             │ ││
│  │ <1024px  │  │   max-width 48rem, mx-auto, px-4–6      │ ││
│  │          │  └──────────────────────────────────────────┘ ││
│  │          │  composer (shrink-0, sticky bottom)           ││
│  │          │    composer-inner max-width 48rem, mx-auto   ││
│  └──────────┴──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

| Token | Value |
|-------|-------|
| `--sidebar-width` | `16rem` (256px) |
| `--content-max` | `min(48rem, 100%)` (~768px) |
| `--composer-radius` | `1.75rem` (stadium pill) |
| `--page-gutter` | `1rem` mobile / `1.5rem` tablet+ |

---

## Background Treatment

- **Single canvas** — `#0d0d0d` base (`--bg-base`) covers the entire viewport; sidebar and main share the same family of near-black grays.
- **Sidebar shade** — `#171717` (`--bg-sidebar`), 1px right edge at 6% white opacity — no blur, no floating panel shadow.
- **Remove** animated orbs, perspective grid, vignette fog as primary decoration. Optional: extremely subtle top radial gradient at 3% opacity only.
- **No boxed chat-shell** — main area is transparent on the unified canvas; no semi-opaque panel wrapper.

---

## Sidebar

- Width `16rem`; header with brand + close (mobile/tablet).
- **New chat** affordance via topbar `+` on mobile when sidebar collapsed.
- Session list: `text-sm`, `py-2`, `px-3`, truncate titles.
- **Active state** — `background: rgba(255,255,255,0.08)`, rounded-lg, no cyan inset bar or glow border.
- Hover: `rgba(255,255,255,0.04)`.
- Footer: Settings only; search as toolbar row with `Ctrl K`.
- Mobile/tablet (`<1024px`): overlay drawer + dim scrim; safe-area padding top/bottom.

---

## Empty State

- Shown when `messages.length === 0`.
- **Greeting** centered in the space above the composer (flex-1, justify-center within chat-main).
- Copy: time-based greeting (`Good morning/afternoon/evening`) + one line subtext.
- Typography: greeting uses optional serif display (`Instrument Serif` or similar) at `clamp(1.75rem, 4vw, 2.25rem)`; subtext `--text-secondary`.
- **No** sci-fi glyph, ring animation, or decorative diamond.
- Composer remains pinned at bottom — empty state never pushes input to the top.

---

## Message Area

- Thread: `chat-thread`, gap `1.5rem`, max-width `--content-max`, centered.
- **Assistant** — full-width text flow, no bubble chrome; prose at `1rem / 1.65`; headings sans, subtle weight only.
- **User** — right-aligned pill: `max-width 85%`, `background rgba(255,255,255,0.08)`, `border-radius 1.25rem`, no border/shadow/blur.
- Code blocks: dark inset `#000` at 40% with subtle radius; inline code muted gray bg.
- Message toolbar: appears on hover/focus; small text buttons, minimal borders.
- Sources / followups: compact chips below assistant content.

---

## Composer Pill

- **Structure** — stadium container (`border-radius: 1.75rem`), bg `--bg-elevated` (#262626 range), 1px `--border-subtle`.
- **Layout** — textarea on top row (full width, transparent bg); bottom toolbar row inside pill:
  - Left: attach (+ icon), mode select as compact chip
  - Right: circular send (arrow) / stop buttons, min 40×40px
- **Placement** — `composer-inner` centered at `max-width: var(--content-max)`; outer `composer` has gradient fade from canvas at bottom, no full-width top border bar.
- Placeholder: `Message unsensoredgpt…`
- Disclaimer below pill: `10px`, `--text-dim`, centered — "unsensoredgpt can make mistakes. Check important info."
- Attachments & followups render above the pill, same max-width column.
- Focus: subtle ring on pill, no large glow halo.

---

## Topbar

- Minimal height; transparent / same as canvas with optional `backdrop-blur-sm` on scroll.
- Toggle sidebar, privacy badge, new-chat on mobile — no duplicate heavy branding bar on desktop when sidebar visible.
- No thick bottom border; use 1px `--border-subtle` only if needed for separation.

---

## Modals (Settings, Search)

- Unchanged behavior; align visually with new palette:
  - Panel bg `#262626`, radius `1rem`, subtle border, reduced blur.
  - Mobile: bottom sheet with drag handle, safe areas.
- Search panel max-width `36rem`.

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `<640px` | Sidebar overlay; composer full gutter width; 44px touch targets; topbar compact |
| `640–1023px` | Sidebar overlay; content gutters `1.5rem` |
| `≥1024px` | Sidebar in grid column; collapsed = 0 width column; thread centered in remaining space |

Safe areas: `env(safe-area-inset-*)` on composer, sidebar, modals.

---

## Motion

- Panel/sidebar slide: `280ms cubic-bezier(0.22, 1, 0.36, 1)`.
- Message appear: `fadeUp 0.35s` (respect `prefers-reduced-motion`).
- No drifting orbs or pulse rings on empty state.
- Modal: scale + translateY entrance, 280ms.

---

## Accessibility

- Focus-visible ring on all interactive elements (`ring-2`, offset on dark bg).
- Send/stop/icon buttons: `aria-label` preserved.
- Minimum 16px input font on mobile (prevent iOS zoom).
- Touch targets ≥44px on mobile for primary actions.
- Color contrast: primary text `#ececec` on `#0d0d0d` (WCAG AA).
- `color-scheme: dark`; modals trap focus via existing JS.

---

## Color Tokens (refined)

```css
:root {
  --bg-base:       #0d0d0d;
  --bg-sidebar:    #171717;
  --bg-elevated:   #262626;
  --bg-input:      #2f2f2f;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --text-primary:  #ececec;
  --text-secondary:#a3a3a3;
  --text-muted:    #737373;
  --text-dim:      #525252;
  --accent-ice:    #7dd3fc;  /* retained, used sparingly */
  --accent-frost:  #38bdf8;
  --accent-glow:   rgba(125, 211, 252, 0.10);
}
```

---

## Files & Scope

| File | Changes |
|------|---------|
| `docs/UI_STANDARD_CHAT_BRIEF.md` | This spec |
| `src/input.css` | Primary styling |
| `tailwind.config.js` | Fonts, tokens if needed |
| `public/index.html` | Layout structure, composer pill, empty state |
| `public/chat.js` | Dynamic greeting only |
| `public/render.js` | Only if message class names change |
| `public/styles.css` | Rebuilt via `npm run build:css` |

**Out of scope:** backend, API, session logic, streaming behavior.

---

## Acceptance Checklist

- [ ] Full-bleed unified dark background (sidebar + main feel connected)
- [ ] Thread centered at ~768px max-width
- [ ] Floating stadium composer with integrated controls
- [ ] Clean empty-state greeting above bottom composer
- [ ] Quiet sidebar with subtle active highlight
- [ ] Assistant text flows without heavy bubbles
- [ ] All features work: stream, stop, attach, followups, settings, search, sessions, privacy badge
- [ ] Mobile overlay sidebar + safe areas
- [ ] `npm run build:css` && `npm test` pass
