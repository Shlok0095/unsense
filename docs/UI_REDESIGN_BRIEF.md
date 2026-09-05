# unsensoredgpt UI Redesign Brief

> Depth prompt guiding the 2030+ futuristic glass-depth aesthetic. Replaces the hacker-terminal neon-green UI entirely.

---

## Vision Statement

Transform unsensoredgpt from a retro terminal hacker aesthetic into a **premium, restrained futurism** — the feeling of conversing inside a dimly lit observatory aboard a deep-space vessel. Calm, intelligent, immersive. Not flashy rainbow cyberpunk; instead: obsidian glass, holographic edge light, volumetric fog, and depth-separated layers that breathe.

---

## Mood Board (in words)

| Material | Description |
|----------|-------------|
| **Obsidian glass** | Deep charcoal panels with 12–18px backdrop blur, 1px frosted borders, 4–8% white inner highlight on top edge |
| **Holographic edges** | Subtle cyan/ice rim light on focus and hover — never full neon wash |
| **Depth fog** | Radial gradients at corners and behind chat canvas; soft volumetric glow, not scanlines |
| **Floating strata** | Sidebar recessed one layer back; composer and modals float forward with shadow depth |
| **Precision grid** | Faint perspective grid receding into void — 40px cells at 2% opacity, no green matrix |
| **Ambient particles** | Optional CSS-only slow-drift orbs (2–3 max), heavily blurred, 5% opacity |

---

## Color System (CSS Variables)

```css
:root {
  /* Background layers (back → front) */
  --bg-void:        #020408;   /* deepest space */
  --bg-deep:        #050a12;   /* base canvas */
  --bg-panel:       rgba(10, 16, 28, 0.78);  /* glass panels */
  --bg-surface:     #0c1220;   /* cards, inputs */
  --bg-elevated:    #111a2a;   /* hover states, chips */

  /* Accent — restrained ice/cyan */
  --accent-ice:     #7dd3fc;
  --accent-frost:   #38bdf8;
  --accent-muted:   #5b9fd4;
  --accent-glow:    rgba(125, 211, 252, 0.12);
  --accent-ring:    rgba(125, 211, 252, 0.35);

  /* Text hierarchy */
  --text-primary:   #e8edf4;
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;
  --text-dim:       #475569;

  /* Borders */
  --border-subtle:  rgba(148, 163, 184, 0.10);
  --border-default: rgba(148, 163, 184, 0.16);
  --border-focus:   rgba(125, 211, 252, 0.30);

  /* Semantic */
  --danger:         #f87171;
  --danger-muted:   rgba(248, 113, 113, 0.15);
  --success:        #6ee7b7;

  /* Glass */
  --glass-blur:     16px;
  --glass-border:   1px solid var(--border-subtle);
  --shadow-depth:   0 8px 32px rgba(0, 0, 0, 0.45);
  --shadow-float:   0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border-subtle);
}
```

---

## Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| **UI sans** | Space Grotesk | 400–600 | All interface copy, labels, buttons, headings |
| **Mono accent** | JetBrains Mono | 400–500 | Code blocks, inline code, session IDs, kbd hints, empty-state glyph |
| **Body chat** | Space Grotesk | 400 | Assistant/user message prose at 17px / 1.65 line-height |

- Move away from monospace-everywhere; mono is reserved for code and micro-accents.
- Headings in chat (h2/h3) use sans with letter-spacing, not uppercase terminal style.
- Minimum 16px on mobile inputs to prevent iOS zoom.

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  [void-bg: grid + fog + ambient orbs]                   │
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │ Sidebar  │  │ Topbar (glass, sticky)               │ │
│  │ (glass,  │  ├──────────────────────────────────────┤ │
│  │  depth   │  │                                      │ │
│  │  layer)  │  │ Chat canvas (immersive, max-width)   │ │
│  │          │  │                                      │ │
│  │          │  ├──────────────────────────────────────┤ │
│  └──────────┘  │ Composer (floating glass dock)       │ │
│                └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- **Sidebar**: Frosted panel, inset shadow on right edge, slides over on mobile/tablet.
- **Chat canvas**: Centered `max-width: 56rem`, generous vertical rhythm (24px gap between messages).
- **Composer**: Floating dock with rounded-2xl glass, subtle lift on focus.
- **Modals**: Centered on desktop; bottom-sheet on mobile with drag-handle affordance.

---

## Motion

| Interaction | Animation |
|-------------|-----------|
| Message enter | `fade-up` 350ms ease-out, 12px translateY |
| Panel slide | 280ms cubic-bezier(0.22, 1, 0.36, 1) |
| Modal open | Overlay fade 220ms; panel scale 0.97→1 + translateY 16px→0 |
| Button hover | Background shift 150ms; active scale 0.97 |
| Typing dots | Soft pulse on ice accent, staggered 150ms |
| Focus ring | 2px ice ring with 2px offset |

**Reduced motion**: `@media (prefers-reduced-motion: reduce)` — disable all animations/transitions to 0.01ms.

---

## Mobile (touch-first)

- Sidebar: full overlay drawer, 88vw max width, safe-area padding top/bottom.
- Modals: bottom-sheet (`rounded-t-2xl`, `max-height: 92dvh`), swipe-friendly close.
- Touch targets: minimum 44×44px on all interactive elements.
- Composer: stacks vertically; mode select and send on same row when space allows.
- Safe areas: `env(safe-area-inset-*)` on topbar, composer, modals.

---

## Component Specs

### Topbar
- Height ~56px, glass background `bg-panel/90`, bottom border subtle.
- Logo wordmark in ice accent; privacy badge as frosted pill.
- Icon buttons: 40px, rounded-xl, border subtle, hover ice tint.

### Sidebar
- Header: app name + close button.
- Toolbar: search button with kbd hint.
- Body: project filter chips + scrollable session history.
- Footer: settings entry.
- Active session: ice left-border accent + subtle bg tint.

### Messages
- **User**: Right-aligned glass bubble, ice border, rounded-2xl with small br-radius cut.
- **Assistant**: Full-width prose, no bubble — content breathes on canvas.
- **Code blocks**: Dark inset panel, mono font, copy button top-right.
- **Source links**: Frosted chips, ice text, hover lift.
- **Toolbar**: Appears on hover/focus, ghost buttons.

### Composer
- Glass container, focus glow (ice, not green).
- Attach icon left; textarea grows; mode select + send/stop right.
- Attachment chips above input; follow-up chips between attachments and input.

### Modals (Settings / Search)
- Overlay: `bg-black/60` + blur.
- Panel: glass, rounded-xl, max-height 80vh.
- Settings sections: uppercase micro-labels in ice; toggles as pill switches.
- Search: icon + input row, results list with hover highlight.

### Buttons
- **Primary (Send)**: Ice gradient fill, dark text, rounded-xl.
- **Stop**: Danger muted border + bg.
- **Ghost**: Border subtle, hover ice border.
- **Icon**: Square rounded-xl, glass bg.

---

## Technical Constraints

- **Scope**: `src/input.css`, `tailwind.config.js`, `public/index.html`, `public/chat.js`, `public/render.js` only.
- **No backend changes**. All existing JS class hooks preserved.
- **No Three.js** — CSS-only depth (transforms, perspective grid, fog gradients). Keeps Vercel static deploy lightweight.
- **Google Fonts**: Space Grotesk (UI) + JetBrains Mono (code).
- **Build**: `npm run build:css` before commit.

---

## Success Criteria

1. Zero neon-green hacker aesthetic remains.
2. All features work: chat, streaming, sidebar, sessions, settings, search, upload, modes, memory.
3. Readable long-form chat at 17px with comfortable line-height.
4. Smooth on phone, tablet, desktop.
5. WCAG-friendly contrast on primary text and interactive elements.
