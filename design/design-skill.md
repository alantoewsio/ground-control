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

### Border radius scale
```
none  0       sm   2px    md   4px
lg    8px     xl   12px   2xl  16px   full  9999px
```
> Cards and section panels use `xl` (12px). Form inputs use `md` or `lg`. Pills and badges use `full`.

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

### Icons (Google Material Symbols — Filled)
**One icon system, one fill style, used everywhere** — toolbars, sidebar, buttons, empty states, table cells, sidebar entity types, modals.

**Loading the font** (in `index.html` or top-level CSS):
```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..700,1,0&display=block"
/>
```
- Variant: **Rounded** (preferred) or **Outlined** — but `FILL=1` is **mandatory** for the project's filled look.
- Loading with `display=block` avoids the FOIT flash of unstyled icon glyphs.
- For offline / air-gapped builds, self-host the variable font file and declare `@font-face` in `fonts.css`.

**Base CSS** (in `index.css`):
```css
.material-symbols-rounded,
.material-symbols-outlined {
  font-family: 'Material Symbols Rounded', 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 20px;          /* default UI size */
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  -webkit-font-feature-settings: 'liga';
  font-feature-settings: 'liga';
  font-variation-settings:
    'FILL' 1,               /* always filled */
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  user-select: none;
}
```

**Usage in JSX** — the icon name is the literal text content of the span:
```jsx
// ✅ Correct — filled material icon
<span className="material-symbols-rounded">settings</span>

// ✅ With size + color via inline style or Tailwind
<span
  className="material-symbols-rounded"
  style={{ fontSize: 18, color: theme.colors.primary.main }}
>
  search
</span>

// ❌ Avoid — do not import lucide-react or any other icon library
import { Settings } from 'lucide-react'
```

**Size scale** (match the spacing/typography rhythm):
```
14px  inline meta (table cells, badges)
16px  small toolbar / dense lists
18px  default button-adjacent icon
20px  sidebar item, standard UI       ← default
24px  section header, prominent action
28px  empty-state, hero
32-44px  service-card hero icon (44×44 container)
```

**Colour rules**:
- Inherit `currentColor` by default — do not hardcode icon colors. Set `color` on the parent and the icon follows.
- Active sidebar item: `color: theme.colors.primary.main` (`#0049BD`).
- Destructive action: `color: theme.colors.action.deny` (`#ef4444`).
- Disabled: `color: theme.colors.text.disabled` (`#9ca3af`).

**Common icon name reference** (Google Material Symbols, filled):
| Use | Icon name |
|-----|-----------|
| Search | `search` |
| Settings | `settings` |
| Add / new | `add` |
| Edit | `edit` |
| Delete | `delete` |
| Save | `save` |
| Close | `close` |
| Expand more | `expand_more` |
| Expand less | `expand_less` |
| Chevron right | `chevron_right` |
| Menu / hamburger | `menu` |
| Filter | `filter_alt` |
| Sort | `sort` |
| Download / export | `download` |
| Upload / import | `upload` |
| Copy | `content_copy` |
| Refresh | `refresh` |
| Info | `info` |
| Warning | `warning` |
| Error | `error` |
| Success / check | `check_circle` |
| User | `person` |
| Logout | `logout` |
| Language | `language` |
| Help | `help` |
| Visibility on / off | `visibility` / `visibility_off` |
| Sidebar collapse | `dock_to_right` / `dock_to_left` |

**Entity-type icons** (used in sidebar + entity rows; one icon per schema):
| Entity | Icon name |
|--------|-----------|
| country | `public` |
| webFilterPolicy | `policy` |
| schedule | `schedule` |
| zone | `lan` |
| network | `hub` |
| application | `apps` |
| webFilter | `filter_list` |
| intrusionPrev | `shield` |
| virusScanning | `security` |
| default | `category` |

> Browse and pick more icons at [fonts.google.com/icons](https://fonts.google.com/icons) — set **Style: Rounded** and **Fill: ON** before copying the name.

### Header
```
bg: #001a47 (never change)
height: 56px (standard), 48px on mobile
left: logo SVG (white) + app name
right: action buttons + language switcher
border-bottom: 1px solid #004A9F
```

### Buttons

**Primary**
```
bg: #005BC8    hover: #004A9F
text: #ffffff   border-radius: 6px
padding: 6px 14px   font-size: 13-14px   font-weight: 500
transition: background-color 150ms ease-in-out
```

**Secondary / ghost**
```
bg: #f3f4f6    hover: #e5e7eb
text: #005BC8   border: transparent
same radius/padding as primary
```

**Disabled state**
```
opacity: 0.5   cursor: not-allowed
```

**Icon-only toolbar buttons**
```
padding: 6px 8px   min-width: 32px   border-radius: 6px
hover bg: rgba(0,0,0,0.06)
```

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

### Badges / pills
```
enabled:   bg #dcfce7  text #166534  (green-100 / green-800)
disabled:  bg #f3f4f6  text #374151
tag:       bg #dbeafe  text #1e40af  (blue-50 / blue-700)
border-radius: 9999px (full)
padding: 2px 8px   font-size: 11-12px   font-weight: 500
```

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
        sticky to the bottom, border-top 1px solid var(--border-light),
        background var(--surface), padding 16px 18px, gap 16px
```
Implementation classes: `.gc-if-flyout__panel`, `.gc-if-flyout__footer`
(base) and per-feature variants (`.gc-hs-flyout__footer`,
`.gc-ips-pol-subflyout__footer`, …) which **must not** override the
`justify-content: flex-start` set on the base.

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
