# Design Skill: Sophos Enterprise Configuration Viewer UI

> Share this file with any AI model to reproduce the same design language and patterns in a new project.
> It is technology-agnostic in description but the reference implementation uses **React + Vite + Tailwind CSS**.

---

## 1. Stack Overview

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React 18 | Functional components + hooks only |
| Build tool | Vite 5 | `base: './'` for portable builds |
| Styling | Tailwind CSS 3 + PostCSS | Extended via a single `theme.js` source-of-truth |
| Icons | Google Material Symbols (Filled) — single icon system everywhere | One family, one fill style, no mixing with stroke icon sets (e.g. lucide) |
| i18n | i18next + react-i18next | All user-visible strings go through `t()` |
| Export | jspdf + jspdf-autotable | PDF output uses a separate `pdfTheme.js` |

---

## 2. Design Token Architecture

### The golden rule
**One file defines every visual value.** All other files consume it. Never hardcode a color, font, shadow, or radius anywhere except in `theme.js` (or its CSS/PDF equivalents).

### File structure
```
src/
  theme.js                  ← master token file (JS object)
  tailwind.config.js        ← extends Tailwind from theme.js
  index.css                 ← @tailwind directives + global CSS rules
  fonts.css                 ← @font-face declarations
  sophos-components.css     ← named component classes (.sophos-*)
  table-theme.css           ← dense-data table overrides
  utils/
    themeUtils.js           ← getThemeStyles(), combineStyles() helpers
    diffTheme.js            ← diff-specific semantic colors
    pdfTheme.js             ← jsPDF color mappings
```

### How components consume tokens
1. **Tailwind classes** for layout, spacing, and common utilities (preferred).
2. **`style={{ }}` inline objects** built from `theme.*` paths for component-specific colors that need to be dynamic or don't map to a Tailwind class.
3. **Named CSS classes** (`.sophos-section-card`, `.sophos-table`, etc.) for shared multi-property patterns.

```js
// ✅ Correct — theme path used for inline style
style={{ backgroundColor: theme.colors.background.primary }}

// ✅ Correct — Tailwind for common spacing/layout
className="flex items-center gap-2 px-4 py-2"

// ❌ Avoid — raw hex in JSX
style={{ backgroundColor: '#ffffff' }}
```

---

## 3. Color Tokens

### Primary brand palette
```
primary.main      #0049BD   — links, active states, focus rings
primary.dark      #004A9F   — button hover, pressed state
primary.light     #E6F2FF   — tinted backgrounds, highlights
primary.gradient  linear-gradient(180deg, #0049BD 0%, #002157 100%)
```

### Secondary / green accent
```
secondary.main    #00A651   — success actions, confirm buttons
secondary.dark    #008A43   — hover
secondary.light   #E6F7ED   — success tint backgrounds
```

### Status / semantic colors
| State | bg | text / border |
|-------|----|---------------|
| success | `#E5F3E8` | `#00851D` |
| error | `#fef2f2` | `#DA3E00` |
| warning | `#FFF4E5` | `#FF8F00` |
| info | `#eff6ff` | `#1e40af` |

### Background scale (light theme only)
```
background.primary    #ffffff   — main surfaces, cards, tables, dialogs
background.app        #F0F2F4   — global app/page background (body, .app-content, .app-main); makes white tables/cards stand out
background.secondary  #f8f9fa   — subtle inner surfaces, footer
background.tertiary   #f3f4f6   — zebra rows, hover areas
background.hover      #f9fafb
background.active     #f3f4f6
```

### Text scale
```
text.primary    #2C2D2E   — body, labels, headings
text.secondary  #777A7D   — sub-labels, captions
text.tertiary   #6b7280   — placeholders, less important meta
text.disabled   #9ca3af
text.inverse    #ffffff   — on dark backgrounds
```

### Border scale
```
border.light   #e5e7eb   — default dividers
border.medium  #d1d5db   — input borders
border.dark    #9ca3af   — strong emphasis
```

### Component header (deep navy)
```
header.bg      #001a47   — always dark navy, never changes
header.border  #004A9F
header.text    #ffffff
```

### Action / policy colors (for data rows and badges)
```
action.accept   #10b981   green-500
action.deny     #ef4444   red-500
action.neutral  #6b7280   gray-500

policy.user     #9333ea   purple-600
policy.network  #2563eb   blue-600
policy.default  #4b5563   gray-600
```

### Entity type color coding
Each entity type gets a distinct hue so rows and sidebar items are instantly scannable:
```
country           #dc2626   red-600
webFilterPolicy   #059669   emerald-600
schedule          #2563eb   blue-600
zone              #9333ea   purple-600
network           #4f46e5   indigo-600
application       #ea580c   orange-600
webFilter         #0d9488   teal-600
intrusionPrev     #e11d48   rose-600
virusScanning     #f59e0b   amber-600
default           #374151   gray-700
```

---

## 4. Typography

### Font families
| Role | Value |
|------|-------|
| Body / UI | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| Brand headings (H1) | `"Lexend Exa", Inter, sans-serif` |
| Sub-headings (H2) | `Lexend, Inter, sans-serif` |
| Monospace | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |

### Size scale (rem)
```
xs    0.75rem   12px
sm    0.875rem  14px   ← default UI text
base  1rem      16px
lg    1.125rem  18px
xl    1.25rem   20px
2xl   1.5rem    24px
3xl   1.875rem  30px
4xl   2.25rem   36px
5xl   3rem      48px
```

### Digital / marketing type scale
| Level | Family | Size | Line-height | Letter-spacing | Weight |
|-------|--------|------|-------------|----------------|--------|
| H1 | Lexend Exa | 64px | 64px | -7.5px | 400 |
| H2 | Lexend | 46px | 46px | -0.75px | 400 |
| H3 | Inter | 26px | 30px | -0.5px | 400 |
| H3 Strong | Inter | 26px | 30px | -0.25px | 600 |
| Paragraph | Inter | 18px | 24px | -0.25px | 400 |
| Inset/caption | Inter | 12px | 15px | 0 | 400 |

### Font weight tokens
```
normal   400
medium   500
semibold 600
bold     700
```

---

## 5. Spacing, Radius, Shadows, Motion, Z-Index

### Spacing scale
```
xs   4px    sm   8px    md   16px
lg   24px   xl   32px   2xl  48px   3xl  64px
```

### Card-chrome alignment (page tabs + table/toolbar below)
Every page that stacks a tab strip on top of a table/card MUST align the two
vertically along the same left x-coordinate. This prevents the "nested" look
where the tab strip looks flush but the title/toolbar/table below appears
indented further inside.

Rule: inside a "page card" (`.content-pane`, `.gc-network-panel`, or
`.firewalls-page` tab-panel), all direct chrome elements share one gutter —
`var(--page-gutter)` (24px):

| Element                              | Horizontal padding                 |
| ------------------------------------ | ---------------------------------- |
| `.gc-tabs`                           | `0 var(--page-gutter)`             |
| `.gc-tab-panel` (container)          | `0` (vertical padding only)        |
| `.firewalls-page__head` (card title) | `var(--page-gutter)`               |
| `.toolbar` (inside a table-wrap)     | `var(--page-gutter)`               |
| `.table-scroll` (inside a table-wrap)| `var(--page-gutter)`               |

Do NOT add an extra `+ var(--table-cell-pad-x-dense)` to title or toolbar
padding to "align with column content" — the cell's own `<td>` / `<th>`
padding already handles that, and stacking the two offsets breaks alignment
with the tab strip above. Do NOT duplicate the page gutter on both
`.gc-tab-panel` AND its inner `.table-wrap` children (that doubling was the
root cause of the pre-fix nested appearance).

When introducing a new page, verify with the browser inspector that the left
edges of (a) the first tab button, (b) the card `<h2>` title, (c) the
toolbar's first control, and (d) the table-scroll gridline all sit at the
same x inside the card.

### Border radius scale
```
none  0       sm   2px    md   4px
lg    8px     xl   12px   2xl  16px   full  9999px
```
> Cards and section panels use `xl` (12px). Form inputs use `md` or `lg`. Pills and badges use `full`.

**Dashboard exception** — all panels on `.dashboard-page` (stat tiles,
widget panels, latency cards, any ad-hoc `.panel`) use a tighter **5px**
radius for a denser monitoring-console feel. Implemented in `style.css` via
`.dashboard-page .panel, .dashboard-page__stat, .dashboard-page__widget,
.dashboard-page__latency-card { border-radius: 5px }`.

### Table framing (no double borders)
The `.table-wrap` container has **no outer border and no border-radius**.
The visual frame around a table is provided by one of:
- the enclosing card — `.gc-network-panel`, `.firewalls-page`, a dashboard
  `.panel`, `.gc-designer__section`, etc. (they own the border/radius/shadow);
- the `--app-bg` (`#F0F2F4`) contrast — pages where the table-wrap has a
  white background (e.g. `.firewalls-page .table-wrap`) float on the light
  app background, which supplies implicit separation without needing a line.

Do NOT re-add `border: 1px solid …` or `border-radius: 6px` to `.table-wrap`
(that causes the inner table to be double-framed inside an already-framed
card). If a standalone table needs a frame, wrap it in a card element
instead of styling `.table-wrap` directly.

### Elevation / shadow scale
```
sm   0 1px 2px rgba(0,0,0,0.05)
md   0px 0px 6px rgba(0,0,0,0.1)         ← default card shadow
lg   0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
xl   0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)
2xl  0 25px 50px rgba(0,0,0,0.25)
```

### Motion / transitions
```
fast    150ms   ← hover color, input border-color
normal  200ms   ← most interactive states
slow    300ms   ← sidebar expand, card hover lift
easing  ease-in-out (default)
```

### Z-index stacking order
```
dropdown      1000
sticky        1020
fixed         1030
modalBackdrop 1040
modal         1050
popover       1060
tooltip       1070
```

---

## 6. App Shell Layout

### Overall page structure
```
┌─────────────────────────────────────────────────────────┐
│  Privacy banner (optional, amber)                       │
├─────────────────────────────────────────────────────────┤
│  Header (fixed height, #001a47 navy)                    │
│    Logo  ·  App title  ·  [nav actions]  ·  Lang picker │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main content (flex-grow, fills remaining height)       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Footer (#f8f9fa, secondary text)                       │
└─────────────────────────────────────────────────────────┘
```

### Home / landing layout
- Full-bleed **hero** with background image + `linear-gradient` navy overlay.
- Constrained container (`max-w-7xl mx-auto`) centred below.
- **Three-card grid** (`.sophos-cards-grid`): 1 col → 2 col (≥640px) → 3 col (≥960px).
- Each card is a `.sophos-service-card` with icon, title, description, circle-arrow CTA.

### Editor layout
```
┌───────────────────────────────────────────────────────┐
│  EditorToolbar (actions, search, export)              │
├──────────┬────────────────────────────────────────────┤
│ Sidebar  │  Main panel                                │
│ (180-    │  ┌──────────────────────────────────────┐  │
│  260px)  │  │ Sub-toolbar (sort, filter, add)       │  │
│ collapse │  ├──────────────────────────────────────┤  │
│ to 48px  │  │ EntityList (scrollable table)         │  │
│          │  └──────────────────────────────────────┘  │
└──────────┴────────────────────────────────────────────┘
```
- Sidebar width is responsive (see §9 Breakpoints).
- `flex flex-1 overflow-hidden` on the row; `min-h-0` on scroll regions.
- Collapsed sidebar shows only icons (48px); expanded shows icon + label.

### Report / diff layout
- Single constrained column (`max-w-5xl` or `max-w-7xl`).
- Sections are `.sophos-section-card` with collapsible `.sophos-section-header`.
- Tables are wrapped in `.sophos-table-wrapper` for horizontal scroll.

---

## 7. Component Patterns

### Icons (`.gc-icon` — single project-wide system)

**One icon system, one fill style, used everywhere** — toolbars, sidebar,
buttons, empty states, table cells, sidebar entity types, modals, badges.
The canonical class is **`.gc-icon`**. There is no other icon library in the
project; do not introduce one.

**Font + axes (locked)**
- Family: **Material Symbols Outlined** (variable font). The Outlined cut is
  the project's choice — the FILL axis is what makes it visually "filled".
- Variable axes: `FILL 1, wght 400, GRAD 0, opsz 20` at default. `wght` ramps
  to 500 at `lg`/`xl` sizes, 600 with `.gc-icon--bold`. **`FILL=1` is
  mandatory** — never render outlined glyphs.
- Loaded once at the top of `static/style.css` with `display=block` to avoid
  the FOIT flash of raw glyph names.

```css
@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..600,0..1,-25..200&display=block");
```

For offline / air-gapped builds, self-host the variable font file and declare
`@font-face` (still pinning Outlined + the FILL=1 axis baseline).

**The `.gc-icon` class** (defined in `static/style.css`)
```css
.gc-icon {
  font-family: "Material Symbols Outlined", sans-serif;
  font-size: 20px;                    /* md = default */
  line-height: 1;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  user-select: none;
  font-feature-settings: 'liga';      /* glyph names render as ligatures */
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}
```

**Size scale** — every size has a helper class. Don't set `font-size` inline
unless you need a one-off hero size that isn't on the scale.

| Modifier         | Size  | Use                                                     |
| ---------------- | ----- | ------------------------------------------------------- |
| `.gc-icon--xs`   | 16 px | inline meta in table cells, badges                      |
| `.gc-icon--sm`   | 18 px | dense toolbars, button-adjacent text                    |
| `.gc-icon--md`   | 20 px | **default** — sidebar items, standard UI, icon-buttons  |
| `.gc-icon--lg`   | 24 px | section headers, prominent actions, modal titles        |
| `.gc-icon--xl`   | 28 px | empty-state, hero, service-card                         |

For service-card hero glyphs that need 32–44 px, use inline `font-size` on
the icon span (rare; do not add new helper classes).

**Colour rules — flow from the container**

Icons inherit `currentColor`. **Set the colour on the parent component, never
on the icon itself.** This is what makes the badge / button system work
without per-icon overrides:

- Inside `.btn-icon--primary` → icon is white (`--btn-primary-fg`)
- Inside `.btn-icon` (Secondary default) → icon is Sophos blue (`--btn-secondary-fg`)
- Inside `.badge--success` → icon is green (`--badge-success-text`)
- Inside `[disabled]` / `[aria-disabled="true"]` → icon picks up the muted
  colour from the disabled state automatically (no extra class needed)

When you do need to override for a one-off (e.g. a danger icon inside a
neutral row), use a colour helper rather than inline CSS:

| Helper                 | Colour                                |
| ---------------------- | ------------------------------------- |
| `.gc-icon--accent`     | `var(--accent)` (link/active blue)    |
| `.gc-icon--muted`      | `var(--text-muted)`                   |
| `.gc-icon--success`    | `var(--success)` (#00851D)            |
| `.gc-icon--danger`     | `var(--danger)` (#DA3E00)             |
| `.gc-icon--warn`       | `var(--error)` (#FF8F00)              |
| `.gc-icon--inverse`    | `var(--text-inverse)` (#fff)          |

**Weight modifier**
- `.gc-icon--bold` → `wght 600` (still filled). Use sparingly for a single
  icon that needs to read heavier than its neighbours.

**Canonical entry points — never hand-roll the `<span>`**

The class system has three matching entry points so the markup is
identical wherever it's emitted from:

```jinja
{# Jinja templates — preferred entry point #}
{% from "partials/_icons.html" import icon %}
{{ icon("close") }}
{{ icon("delete", size="sm", cls="gc-icon--danger") }}
{{ icon("check_circle", size="lg", aria_label="Saved") }}
```

```js
// JavaScript — for dynamic markup (counterpart to the Jinja macro)
gcIcon("close")                                     // -> HTML string
gcIcon("delete", { size: "sm", cls: "gc-icon--danger" })
gcIconEl("check_circle", { ariaLabel: "Saved" })    // -> HTMLSpanElement
```

```html
<!-- Raw HTML, only when neither macro is available -->
<span class="gc-icon gc-icon--md" aria-hidden="true">settings</span>
```

The macros automatically:
- emit `aria-hidden="true"` for **decorative** icons (no label given)
- emit `role="img" aria-label="…"` for **meaningful** icons (label given)

This is the project's accessibility contract — do not write raw `<span>`
markup that breaks it.

**Icons inside buttons (auto-sized by the button)**

`.btn-icon .gc-icon` (and `.icon-btn .gc-icon`) inherits `font-size` from the
button container. So inside the 32 × 32 icon-button (padding 6) the glyph
naturally sizes to its 20 × 20 inner box — no size modifier required:

```html
<!-- icon size is driven by the button, not the gc-icon class -->
<button class="btn-icon" aria-label="More">
  <span class="gc-icon">more_vert</span>
</button>
```

**Common icon-name reference** (Material Symbols Outlined, FILL=1)

| Use                  | Glyph name                           |
| -------------------- | ------------------------------------ |
| Search               | `search`                             |
| Settings             | `settings`                           |
| Add / new            | `add`                                |
| Edit                 | `edit`                               |
| Delete               | `delete`                             |
| Save                 | `save`                               |
| Close                | `close`                              |
| Expand more / less   | `expand_more` / `expand_less`        |
| Chevron right        | `chevron_right`                      |
| Menu / hamburger     | `menu`                               |
| More (overflow)      | `more_vert`                          |
| Filter               | `filter_alt`                         |
| Sort                 | `sort`                               |
| Download / export    | `download`                           |
| Upload / import      | `upload`                             |
| Copy                 | `content_copy`                       |
| Refresh              | `refresh`                            |
| Info                 | `info`                               |
| Warning              | `warning`                            |
| Error                | `error`                              |
| Success / check      | `check_circle`                       |
| User                 | `person`                             |
| Logout               | `logout`                             |
| Language             | `language`                           |
| Help                 | `help`                               |
| Visibility on / off  | `visibility` / `visibility_off`      |
| Sidebar dock         | `dock_to_right` / `dock_to_left`     |

**Entity-type icons** (sidebar + entity rows — one glyph per schema):

| Entity            | Glyph name     |
| ----------------- | -------------- |
| country           | `public`       |
| webFilterPolicy   | `policy`       |
| schedule          | `schedule`     |
| zone              | `lan`          |
| network           | `hub`          |
| application       | `apps`         |
| webFilter         | `filter_list`  |
| intrusionPrev     | `shield`       |
| virusScanning     | `security`     |
| default           | `category`     |

> Browse and pick more glyphs at [fonts.google.com/icons](https://fonts.google.com/icons)
> — set **Style: Outlined** and **Fill: ON** before copying the name.

**Quick checklist when adding a new icon to the app**
1. Use the `icon(...)` Jinja macro (or `gcIcon(...)` in JS). Never paste raw
   `<svg>` or import an icon library.
2. Pick the smallest size that's legible — default to `md` (20 px); use `xs`
   in dense table cells, `lg`/`xl` only for headers/empty states.
3. Don't set the colour on the icon. Set it on the container component
   (button variant, badge variant, status text) and let `currentColor` do its
   job. Reach for a `.gc-icon--*` colour helper only for genuine one-offs.
4. If the icon is meaningful (the only thing labelling a control), pass
   `aria_label="…"`. Otherwise leave it decorative — the macro auto-hides it
   from screen readers.

### Header
```
bg: #001a47 (never change)
height: 56px (standard), 48px on mobile
left: logo SVG (white) + app name
right: action buttons + language switcher
border-bottom: 1px solid #004A9F
```

### Buttons (Figma: button-icons-usage-light)

The button system is three variants (**Primary / Secondary / Tertiary**) × five
states (**Default / Hover / Focus / Active / Disabled**) sharing one focus ring
and one radius. **All buttons — text and icon — consume the `--btn-*` tokens.
Do not hand-roll colours at the call site.**

**Shared tokens** (`:root`)
```
--btn-radius            : 5px
--focus-ring            : #008BFF   (2px outline, offset 0, all variants)
--btn-primary-bg        : #005BC8
--btn-primary-hover-bg  : #006AD1
--btn-primary-fg        : #ffffff
--btn-secondary-bg      : #F0F2F4
--btn-secondary-hover-bg: #E5E7EA
--btn-secondary-fg      : #005BC8
--btn-tertiary-hover-bg : #F0F2F4
--btn-tertiary-fg       : #005BC8
--btn-disabled-bg       : #C2C5CA
--btn-disabled-fg       : #A3A6AB
```

**Text buttons** — `.btn.primary`, `.btn--secondary`
```
padding      : 6px 14px         font-size  : 13–14px    font-weight: 500
radius       : 5px              transition : background-color 150ms
focus        : outline 2px solid #008BFF, offset 0
```

**Icon buttons** — `.btn-icon` + optional variant/size modifiers
```
box          : 32 × 32  (width + height)     padding  : 6px
icon         : 20 × 20                        gap      : 10px (icon + label)
radius       : 5px                            display  : inline-flex, centered
focus        : outline 2px solid #008BFF, offset 0
```

**Per-variant × per-state matrix** (the full Figma grid)

Every icon button supports six states: **Default / Hover / Focus / Active /
Disabled / Disabled-onHover** (the last shows a native `title` tooltip
explaining *why* it's disabled — see "Disabled with reason" below).

| State                | Primary                             | Secondary (default)                  | Tertiary (ghost)                       |
| -------------------- | ----------------------------------- | ------------------------------------ | -------------------------------------- |
| Default              | bg #005BC8 / icon #FFFFFF           | bg #F0F2F4 / icon #005BC8            | bg transparent / icon #005BC8          |
| Hover                | bg #006AD1 / icon #FFFFFF           | bg #E5E7EA / icon #005BC8            | bg #F0F2F4 / icon #005BC8              |
| Focus                | + outline 2px #008BFF (offset 0)    | + outline 2px #008BFF (offset 0)     | + outline 2px #008BFF (offset 0)       |
| Active               | bg #005BC8                          | bg #F0F2F4                           | bg #F0F2F4                             |
| Disabled             | bg #C2C5CA, opacity 0.5, icon #FFF  | bg #F0F2F4, opacity 0.5, icon #A3A6AB | transparent, opacity 0.5, icon #A3A6AB |
| Disabled-onHover     | identical to Disabled + `title` tooltip on hover (no hover style applied) |||

Focus is identical across all three variants: a 2 px solid `#008BFF` outline
at offset 0 — a ring, not a border, so it doesn't push layout.

**Class usage**
```html
<!-- Text buttons -->
<button class="btn primary">Save</button>
<button class="btn btn--secondary">Cancel</button>

<!-- Icon buttons (32 × 32) -->
<button class="btn-icon" aria-label="More">…</button>                  <!-- secondary (default) -->
<button class="btn-icon btn-icon--primary" aria-label="Add">…</button>
<button class="btn-icon btn-icon--tertiary" aria-label="Edit">…</button>

<!-- Tertiary Inline (24 × 24) — pairs with any variant -->
<button class="btn-icon btn-icon--inline btn-icon--tertiary" aria-label="Next">…</button>
```

**Tertiary Inline size** (24 × 24): for in-row affordances (next / expand /
remove). Same 5 px radius, same #008BFF focus ring; only `width`,`height` and
`padding` change (24 × 24, padding 2 px). Icon stays 20 × 20.

**Why `.btn-icon` defaults to Secondary**: it's the most common icon-button
style in dense toolbars and table cells. Opt into Primary (call-to-action)
or Tertiary (ghost on an already-tinted surface) explicitly with the modifier.

**Disabled with reason — the `aria-disabled` + `title` pattern**

Native `<button disabled>` blocks pointer events on Chromium, so a `title`
attribute on a disabled button *never* fires a tooltip. To honour the Figma
"Disabled-onHover shows reason" state, use **`aria-disabled="true"`** instead
of the native `disabled` attribute when the button needs to explain itself,
and provide a short `title`:

```html
<!-- Pattern A: hard-disabled (no reason needed) -->
<button class="btn-icon btn-icon--primary" disabled aria-label="Add">…</button>

<!-- Pattern B: disabled WITH reason — hover shows the native title tooltip -->
<button class="btn-icon btn-icon--primary"
        aria-disabled="true"
        title="Select at least one row to enable Export"
        aria-label="Export">…</button>
```

The CSS styles `[aria-disabled="true"]` identically to `:disabled` (opacity
0.5, muted icon colour, `cursor: not-allowed`) **and** keeps `pointer-events`
live so the browser can render the `title` tooltip on hover. Hover-state
colours are intentionally *not* applied — the only difference between
"Disabled" and "Disabled-onHover" is the tooltip surfacing, never a colour
change.

**Click-handling rule**: any button using `aria-disabled="true"` MUST early-
return in its click handler (e.g. `if (el.getAttribute('aria-disabled') ===
'true') return;`). Unlike the native `disabled` attribute, ARIA does not
suppress the click — it only declares the state semantically.

### Form inputs
```js
const INPUT_STYLE = {
  height: 32,
  padding: '0 10px',
  fontSize: '13px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontFamily: 'Inter, ...',
  color: '#2C2D2E',
  backgroundColor: '#ffffff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 150ms, box-shadow 150ms',
}

// Focus state (applied via onFocus handler):
borderColor: '#005BC8'
boxShadow: '0 0 0 2px rgba(0,91,200,0.13)'

// Error state:
borderColor: '#ef4444'
```

### Badges (global `.badge` component)

Single source of truth for status / label badges across the app (task-queue
status, action labels, sync state, dirty markers, inventory state, etc.). Use
the `.badge` class with one semantic modifier — never hand-roll colours.

**Markup**
```html
<span class="badge badge--success">Active</span>
<span class="badge badge--info">Syncing</span>
<span class="badge badge--warning">Pending</span>
<span class="badge badge--danger">Error</span>
<span class="badge badge--neutral">Draft</span>
```

**Typography** (locked — do not override per usage)
```
font-family : Inter (inherited from :root)
font-weight : 700
font-size   : 12px
line-height : 16px
letter-spacing: 0
```

**Layout / box**
```
display       : inline-flex (centered)
min-width     : 56px        height : 20px
padding       : 2px 7px     gap    : 10px (icon + text)
border-radius : 3px         opacity: 1
white-space   : nowrap
```
Width is a `min-width` so longer labels (`Completed`, `In progress`) don't
clip. The 56 px floor keeps single-word badges visually consistent in dense
table cells.

**Colour palette** (paired bg + text per level, exposed as tokens)
```
neutral  bg #F0F2F4  text #696A6B   --badge-neutral-bg / --badge-neutral-text
info     bg #E5EFFA  text #005BC8   --badge-info-bg    / --badge-info-text
success  bg #E5F3E8  text #00851D   --badge-success-bg / --badge-success-text
warning  bg #FFF4E5  text #FF8F00   --badge-warning-bg / --badge-warning-text
danger   bg #FBECE5  text #DA3E00   --badge-danger-bg  / --badge-danger-text
```
`.badge--warn` aliases `.badge--warning`; `.badge--critical` aliases
`.badge--danger`.

**When NOT to use**
- Tiny circular **count** indicators (e.g. sidebar `(3)` pending bubble,
  `.task-queue-nav-badge`, `.gc-firewall-pill-status` 1 rem dot) are a
  separate primitive and intentionally do not use `.badge`.
- Removable input chips / tag chips (e.g. `.gc-designer-tags__pill`) are a
  separate primitive (`x` close affordance, drag handles, etc.).

**Migration note**
Legacy classes that map onto this spec — `.task-queue-status-badge`,
`.task-queue-action-pill` — already consume the `--badge-*` tokens and the
locked typography/box values. New status indicators should use `.badge`
directly rather than adding new bespoke classes.

### Cards / section panels
```css
.sophos-section-card {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;                /* xl */
  box-shadow: 0px 0px 6px 0px rgba(0,0,0,0.1);  /* md */
  overflow: hidden;
}
```
Collapsible header:
```
padding: 12px 16px   font-size: 16px   font-weight: 600
hover-bg: #f9fafb   transition: background-color 150ms
chevron: Material Symbol `expand_more` / `expand_less` (filled), 18px, color #6b7280
```

### Tables (dense-data)
```
header row:  bg #f9fafb   text #6b7280   font-size 12px   font-weight 600   uppercase letter-spacing 0.05em
body row:    bg #ffffff   border-bottom 1px solid #e5e7eb
row hover:   bg #f9fafb
padding:     th 8px 12px   td 8px 12px
sticky header: position sticky top 0 z-index 10
column resize: drag handle, min-width enforced
```

### Service / landing cards
- White surface with a purple radial glow **behind** the card that fades in on hover.
- `transform: translateY(-3px)` lift on hover.
- Circle arrow button (border `rgba(32,6,247,0.25)`) fills solid `#2006f7` on hover.
- Icon container: 44×44px, `border-radius: 12px`, subtle shadow.

### Modals
```
backdrop: rgba(0,0,0,0.4)   z-index: 1040
dialog:   bg #ffffff   border-radius: 12px   shadow: xl   z-index: 1050
max-width: 480-640px depending on content density
header: 16px semibold + close button top-right
footer: right-aligned actions (cancel secondary, confirm primary)
```

### Flyouts (single-record add / edit panels)
Slide-in side panels used for creating or editing one record (Add IP Host,
Edit VLAN, Add Zone, IPS policy, Web Filter policy, etc.). Anchored to the
right edge, full viewport height, and resizable via the left handle.
```
position: fixed right   width: 360-720px (resizable)   full height
bg: #ffffff   shadow: 2xl   border-left: 1px solid #e5e7eb
z-index: 1050
header: 16px semibold + close button top-right (close = "×" icon)
body:   scrollable, padding 16-20px, form fields stacked
footer: LEFT-aligned actions (primary first, then secondary / Cancel)
        sticky to the bottom, border-top 1px solid var(--border),
        background var(--surface-hover), padding 12px var(--space-md),
        gap var(--space-sm)
```
Implementation classes: `.gc-if-flyout__panel`, `.gc-if-flyout__footer`
(base) and per-feature variants (`.gc-hs-flyout__footer`,
`.gc-ips-pol-subflyout__footer`, …) which **must not** override the
`justify-content: flex-start`, padding, gap, border or background set on the
base. The canonical reference is the Hosts & Services Add flyout — every
other flyout's footer should look identical at the bottom edge.

> **Why left-aligned (vs right-aligned modals?)** Flyouts open from the
> right edge, so the natural reading flow places the primary action where
> the user's eye lands first after scanning the form. Modals are centered
> and follow the conventional "Cancel | Confirm" right-aligned pattern.
> A destructive secondary action (e.g. Delete) is allowed on the far right
> via `margin-left: auto` on that single element.

### Drawers (bulk operations)
```
position: fixed right   width: 420-480px   full height
bg: #ffffff   shadow: 2xl   border-left: 1px solid #e5e7eb
z-index: 1050
```

### Toasts / notifications
```
position: fixed bottom-right   margin: 16px
bg: solid (success #00A651, error #DA3E00, info #0049BD)
text: #ffffff   border-radius: 8px   padding: 10px 16px
font-size: 13px   shadow: lg
auto-dismiss: 3-5 seconds
```

### Search affordance (global)
```
appearance: looks like an input (bg #ffffff, border, border-radius: 6px)
left icon: magnifier (`<span class="material-symbols-rounded">search</span>`, filled)
right shortcut badge: "Ctrl+K" / "⌘K" in <kbd> styled as a pill
opens full overlay modal (z-index: 1060)
keyboard shortcut: Ctrl/Cmd+K to open, Escape to close
```

### Sidebar navigation
```
width: 180px collapsed to 48px (icon-only)
bg: #ffffff   border-right: 1px solid #e5e7eb
sections: grouped by category with a small label
item: icon (20px) + label, height 36px, border-radius: 6px
item active: bg primary.light (#E6F2FF)   text primary.main (#0049BD)
item hover: bg #f3f4f6
collapse toggle button at top or bottom
```

### Experimental / beta pill
```
background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%)
text: #ffffff   font-size: 10px   font-weight: 600   letter-spacing: 0.05em
border-radius: 9999px   padding: 2px 8px   text-transform: uppercase
```

---

## 8. Accessibility Patterns

These are **non-negotiable** in every view:

```css
/* Keyboard focus ring */
*:focus-visible {
  outline: 2px solid #005BC8;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Remove ring for mouse clicks */
*:focus:not(:focus-visible) { outline: none; }

/* Skip link for screen readers */
.sr-skip-link { position: absolute; left: -9999px; /* ... */ }
.sr-skip-link:focus { position: fixed; top: 8px; left: 8px; /* visible */ }

/* Touch targets */
@media (pointer: coarse) {
  button, [role="button"], a, select {
    min-height: 36px;
    min-width: 36px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Responsive Breakpoints

Tailwind breakpoints used (standard):
```
sm    640px
md    768px
lg    1024px
xl    1280px
2xl   1536px
```

Custom breakpoints in CSS:
```
960px  — 3-column card grid activates
1366px — table compact mode
1920px — 4K: sidebar widens, toolbar buttons enlarge
2560px — QHD: further scale-up
```

Sidebar width by breakpoint:
```
default (collapsed): 48px
default (expanded):  180px
≥768px:  200px
≥1024px: 220px
≥1536px: 240px
≥1920px: 260px  (collapsed: 56px)
```

Mobile detection for auto-collapse:
```js
const isMobile = window.matchMedia('(max-width: 767px)').matches
```

---

## 10. Scrollbar Style

Apply globally — thin overlay-style that only appears on hover:
```css
/* Firefox */
* { scrollbar-width: thin; scrollbar-color: transparent transparent; }
*:hover, *:focus-within { scrollbar-color: rgba(0,0,0,0.18) transparent; }

/* WebKit */
::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.12);
  border-radius: 3px;
  transition: background 0.2s ease;
}
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.28); }
```

---

## 11. Print Styles

```css
@media print {
  @page { margin: 1cm; size: A4; }
  header, button, nav, input, select { display: none !important; }
  body { font-size: 11pt; line-height: 1.4; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .page-break { page-break-after: always; }
  .rule-section { page-break-inside: avoid; }
}
```

---

## 12. State Management Pattern (App-Level)

```js
// Single mode state drives which view mounts
const [mode, setMode] = useState(null) // null | 'report' | 'diff' | 'editor'

// Navigation: header logo/title resets to home (mode = null)
// Each mode is a full-screen view component
```

Within the editor, all entity state lives in a single `state` object managed via `useReducer` or `useState` with an action-based update pattern.

---

## 13. XML / Config Data Patterns

- XML is parsed into typed entity objects (`parseEntitiesXML`).
- Entity schemas (`editor/schemas/*.js`) define fields, types, validation rules, and the **Google Material Symbols (Filled)** icon name per entity type (see §7 Icons → Entity-type icons).
- `EntityList` renders rows; `EntityForm` renders field controls driven by the schema — not handwritten field-by-field JSX.
- Diffs are computed at the XML level (`compareXMLFiles`) and rendered with semantic diff colors (see `diffTheme.js`).

---

## 14. Naming Conventions

| Scope | Convention | Example |
|-------|-----------|---------|
| CSS utility classes | `sophos-*` prefix | `.sophos-section-card` |
| Editor-specific CSS | `editor-*` prefix | `.editor-sidebar-panel` |
| Entity table CSS | `sfcv-*` prefix | `.sfcv-entity-table` |
| React components | PascalCase | `EntityFormModal.jsx` |
| Hooks | `use` prefix | `useEditorState.js` |
| Theme paths | dot-notation | `theme.colors.primary.main` |
| i18n keys | dot-notation namespaced | `editor.toolbar.save` |

---

## 15. Quick-Start Checklist for a New Project

When creating a new project with this design pattern:

- [ ] Copy `theme.js` and adapt brand colors (keep the token structure identical)
- [ ] Extend `tailwind.config.js` from `theme.js` values
- [ ] Add `index.css` with scrollbar, focus ring, accessibility, and print layers
- [ ] Add `fonts.css` with Inter + Lexend Exa `@font-face` or CDN links
- [ ] Load **Google Material Symbols Rounded** with `FILL=1` and add the `.material-symbols-rounded` base class (see §7 Icons) — do **not** install lucide-react or any other icon library
- [ ] Create `sophos-components.css` (or rename to match your brand prefix)
- [ ] Create a `themeUtils.js` with `getThemeStyles` / `combineStyles` helpers
- [ ] Build header with deep navy (`#001a47`) and white logo
- [ ] Use `flex flex-col h-screen` on the app root; header fixed, main `flex-grow`, footer auto
- [ ] Implement collapsible sidebar with `width` transition (CSS `transition: width 0.2s ease`)
- [ ] Always use `min-h-0` + `overflow-hidden` on flex parents of scrollable lists
- [ ] Wire keyboard shortcut `Ctrl/Cmd+K` to global search overlay
- [ ] Ensure focus rings, skip link, and touch targets are present before shipping

---

*Generated from the Sophos Firewall Configuration Viewer project — React 18 / Vite 5 / Tailwind CSS 3.*
