# Footlink Scout — Design System

The design system of **Footlink Scout**, a Brazilian football-scouting SaaS. It is a data-dense, Portuguese-language web application used by club scouting departments, agencies and federations to find athletes, track their performance, run scouting workflows and negotiate transfers.

The product is one thing: a single-page web app (React + TypeScript + SCSS modules) served from `index.html`. There is no marketing site, no mobile app and no docs site in the sources provided.

## Modules of the product

| Module | Route | Purpose |
|---|---|---|
| Meu Feed | `/home` | Dashboard with a 3:6:3 flex layout; centre column is *Últimas Movimentações* |
| Busca Avançada | `/busca-avancada` | Filter aside + athlete table; the core scouting surface |
| Atletas / Detalhe do atleta | `/atletas`, `/atleta/:id` | Athlete profile with overview, notes, evaluations, career, performance, matches, videos |
| Clubes | `/clubes-brasileiros` | Club directory |
| Competições | `/competicoes` | Competition directory with category tabs down to Sub-9 |
| Análise de Mercado · Mercado de Transferências | — | Market analytics and transfer market |
| Agências | `/agencias` | Agency directory with category and FIFA badges |
| Projetos | `/projetos`, `…/workflow` | Scouting projects with a kanban workflow board |
| Relatórios PRO | `/relatorios-pro` | Report cards in a fixed 3-column grid |
| Mensagens | `/mensagens` | Three-panel messaging between clubs, athletes and agents |
| Perfil · Configuração | — | User and organisation settings |

## Sources this system was built from

Everything here was lifted from a mounted read-only folder, `design-md/`, containing the product team's own design documentation. No Figma file, no repository and no live app were available.

| File | What it gave us |
|---|---|
| `design-md/DESIGN.md` | 1 636 lines — the product's declared single source of truth: brand, type scale, full colour palette with dark-mode overrides, and per-component specs (Button, MonitoringButton, Input, SegmentedToggle, Table, Kanban, Card, AppBar, NavDrawer, Dialog, Badges, Tooltips, Icons, Animations, Layout, Grids, Flags, Messages) |
| `design-md/design_system.html` | 7 853-line interactive reference; source of the two **logo SVGs** and the brand mark extracted into `assets/` |
| `design-md/detalhe-atleta.html` | Full athlete-detail page mock — exact CSS for the athlete header, split monitor button, info/vínculo cards and the compact performance tables |
| `design-md/template.html` | Dashboard module template (Competições) — AppBar, gender switcher, page header, filter bar, institutional table, pagination, side menu |
| `design-md/index.html` | The React app shell only (`<div id="root">`, GTM tag, `Vector.svg` favicon) — confirms there is a single SPA product |

Referenced inside `DESIGN.md` but **not present** in the mount (so not copied here): `src/_variables.scss`, `src/index.scss`, all `*.module.scss` files, `src/assets/ico/menu/*.svg` (11 module icons), `src/assets/ico/*.png` (stat-column icons: `ico-tempo`, `ico-jogos`, `ico-titular`, `ico-banco`, `ico-gols`, `ico-amarelos`, `ico-amarelo-vermelho`, `ico-vermelhos`), `src/assets/notebook.png`, and the language-picker flags `br-flag.png` / `uk-flag.png` / `sp-flag.png`. See **Gaps and substitutions** below.

---

## Index

| Path | What it is |
|---|---|
| `styles.css` | The one entry point consumers link. `@import` list only. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `elevation.css`, `motion.css`, `semantic.css`, `theme-dark.css`, `base.css` |
| `assets/` | `footlink-color-logo.svg`, `footlink-white-logo.svg`, `footlink-mark.svg` |
| `components/` | `core/`, `forms/`, `navigation/`, `data/`, `domain/`, `feedback/` — see the list below |
| `guidelines/` | 22 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `ui_kits/footlink-scout/` | Interactive recreation of five product screens — start at `index.html` |
| `thumbnail.html` | Homepage tile |
| `SKILL.md` | Agent-Skills front matter for use in Claude Code |

## Components

Grouped by concern. Every family here has a counterpart in `DESIGN.md`; nothing was invented.

**`components/core/`** — `Button`, `Card`, `Badge` (+ `CountBadge`, `NotificationDot`), `Avatar`, `Tooltip`
**`components/forms/`** — `Input`, `Select`, `SegmentedToggle` (+ `GenderSwitcher`)
**`components/navigation/`** — `AppBar`, `NavDrawer`, `Tabs` (+ `TabButtons`), `Pagination`
**`components/data/`** — `Table` (+ `AthleteCell`, `ClubCell`), `Flag` (+ `NationalitiesRow`, `CountryRow`), `StatusPill`
**`components/domain/`** — `MonitoringButton`, `AthleteCard`, `KanbanColumn` (+ `AddColumnButton`)
**`components/feedback/`** — `Dialog`, `EmptyState`, `ChatMessage` (+ `DatePill`)

### Intentional additions

- **`Select`** — `DESIGN.md` documents `Input` but not a select; `template.html` styles `select.input` inline. Promoted to a component so filter bars stay consistent.
- **`Pagination`** — the table footer pattern in `template.html` has no component in the source, but appears under every institutional table.
- **`StatusPill`** — separated from `Badge` because the source uses two distinct pill specs (`4px 12px` table statuses vs `3px 10px` letter-spaced category badges).
- **`AthleteCell` / `ClubCell` / `ContractBlock`** — table-cell and header compositions documented in `DESIGN.md` §4c but not exported as components in the source.

---

## Content fundamentals

**Language.** Brazilian Portuguese, always. Interface strings are never English, even for technical concepts (`Monitorar`, `Busca avançada`, `Vínculo`, `Âmbito`, `Fim de contrato`). The language picker offers pt-BR, en and es, but pt-BR is the design language — write copy in Portuguese and let translation follow.

**Person.** Impersonal or second-person plural-formal. The product addresses the user with implied *você* but rarely says it: *"Acompanhe o desempenho de atletas…"*, *"Filtre por posição, idade…"*, *"Busque atletas ou clubes..."*. Never first person — no *"Meus dados"*-style possessives except the two established labels **Meu Feed** and **Ver Meu Perfil**.

**Verbs are imperative and short.** `Salvar`, `Cancelar`, `Excluir`, `Monitorar`, `Notificar`, `Aplicar filtros`, `Gerar Relatório`, `Editar dados do atleta`, `Falar com clube`, `Falar com agência`, `Ver Desempenho Completo`, `Ver todos os jogos`, `Adicionar atleta`, `Nova coluna`, `GERENCIAR`.

**Casing.** Sentence case for headings, buttons and body (`Desempenho recente`, not `Desempenho Recente`) — with two deliberate exceptions:
1. **Uppercase micro-labels**: field labels, table headers, module spans, badges, kanban column titles, contract labels (`CLUBE ATUAL`, `AGÊNCIA`, `MÓDULOS`, `COMPETIÇÃO`, `BRASIL`, `FIFA`).
2. **Proper nouns kept verbatim**: `Brasileirão Série A`, `Copa Libertadores`, `CR Flamengo`, `ROC NATION`, `CBF`, `FERJ`, `CONMEBOL`.

**Descriptions are one sentence, factual, no marketing.** Module headers get a single explanatory line under the title: *"Acompanhe o desempenho de atletas em todas as categorias e fases das competições nacionais e internacionais."* No exclamation marks. No superlatives. No "powerful", "seamless" or "revolutionary".

**Data is stated, never dressed up.** `2.450'` for minutes. `23 anos`. `1,76 m` / `73 kg` (comma decimals, metric). Dates as `dd/mm/aa` in tables (`17/01/24`) and `dd/mm/aaaa` in detail fields (`12/07/2000`). Seasons as `2023/2024`. Contract ends as `Fim: 30/06/2027`. Position abbreviations in dense contexts (`PE`, `ZAG`, `ATA`, `LD`, `LE`), spelled out in profiles (`Ponta Esquerda`).

**Empty states name the problem and the fix**, in two lines: *"Nenhum atleta encontrado"* / *"Ajuste os filtros e tente novamente."*

**Emoji: no.** The brand does not use emoji anywhere. The one place a flag emoji appears in `template.html` (`🇧🇷 Brasil`) is a mock shortcut — the shipped pattern is always a flag **image** from the CDN. Do not introduce emoji.

**Vibe.** Professional, quiet, dense. This is a working tool for people who read tables all day: the interface earns trust by being precise and unshowy. The only expressive moment in the whole product is the purple.

---

## Visual foundations

### Colour

One dominant brand colour and almost nothing else: **`#5a00ff` (`--lightPurple1`)** — an electric, fully-saturated violet. It is the primary action, the link, the focus ring, the active state, the AppBar background and the athlete's name in every table. Around it sit a tight neutral ramp (`#000` → `#f5f5f5`) and a near-black violet `#09001a` (`--darkPurple1`) used both as strong text and as the dark surface.

- **Two background colours per screen, maximum**: `--light` (#f5f5f5) for the page, `--white` for surfaces. The purple AppBar is the third, and it is the only chrome.
- **Semantic colours are conventional and used sparingly**: `#eb5757` error, `#219653` success, `#f5a623` / `#f2994a` warning-and-monitoring, `#29b6f6` info. `--orange2` carries a specific meaning — *monitoring is active*.
- **Module colours are fixed identity**, not decoration: Feed blue, Busca green, Clubes red, Competições orange, Análise purple, Mercado green, Agências grey. Never reassign them.
- **Opacity is the tinting mechanism.** The system does not define a 50-step purple ramp; it layers `rgba(90,0,255, α)` at documented steps: `.20` nav-active, `.12` focus ring, `.07` empty-state circle, `.05` chips.
- **Contrast**: white on `#5a00ff` ≈ 4.8:1, white on `#09001a` ≈ 19:1, `#5a00ff` on `#eee5ff` ≈ 4.2:1. Keep body text at `--black`/`--gray2` on white; use `--gray3` only for 11–12px labels.

### Type

**Barlow, and only Barlow** — weights 100–900, loaded from Google Fonts. No serif, no display face, no mono in the product (`--font-mono` exists here only for token chips in the specimen cards).

- Headings run 700–800 with **negative tracking** at large sizes (−0.03em at 48px, −0.02em at 36px, −0.01em at 28px) and none at 22px and below.
- **14px/400 is the working size** of the interface — table cells, metadata, most body copy.
- Micro-labels invert the rule: 11–12px, weight 600–700, **positive tracking** (+0.05 to +0.06em), uppercase.
- Line-heights: 1.1–1.25 for headings, 1.5 for body, 1.4 for captions.
- `-webkit-font-smoothing: antialiased` on `body`.

### Space and layout

- **Vertical rhythm is 15 / 20 / 24 / 30**, not a strict 4/8 grid — the source uses `0.575rem 0.75rem` inputs, `10px 15px` table cells, `14px 8px 12px 16px` kanban headers. Copy the exact values; do not snap them.
- Fixed constants everything else hangs off: AppBar **60px**, NavDrawer **320px**, kanban column **320px**, page gutter **30px**, card padding **24px**.
- Containers are wide: 1400px on detail pages, 1624px on card grids, 1720px on Mensagens. Full-width (no max) on directory pages.
- Five page grids only — see the *Padrões de grid* card: single column, flex 3:6:3, fixed 3-col, auto-fill `minmax(350px,1fr)`, sidebar + `flex:1`.
- **Fixed elements**: the AppBar (`position:fixed`, `z-index:1000`); page headers stick below it at `top:60px`; sortable table headers stick at `--sticky-header-offset`. NavDrawer `z-index:11000`, dialog backdrop `10000`, dialog `10001`, tooltips `1100`.

### Backgrounds

Flat colour. **No photographic backgrounds, no illustrations, no repeating patterns, no textures, no noise.** The only non-flat surfaces in the system are five documented 135° gradients — `hero-dark`, `primary`, `card-dark`, `accent-vivid`, `light-surface` — reserved for marketing-style hero sections and decorative accents, never behind data. Imagery in the product is exclusively *content*: athlete photos (colour, uncropped, full-bleed inside a circle), club crests (transparent PNG, unmodified, never rounded), and country flags. No grain, no duotone, no colour grading — a crest looks exactly as the club supplies it.

### Corners

Not one radius but a purposeful ladder: **2px** flags · **3px** crest overlays · **6px** tooltips and small icon buttons · **8px** the default for buttons, inputs, nav items and dialogs · **10px** kanban cards and module icon boxes · **12px** cards, tables, panels · **15px** profile cards · **20px** pills · **50%** avatars.

### Cards

White, 12px radius, `1px solid --gray5` border, 24px padding, and a shadow so shallow it reads as a hairline: `0 2px 8px rgba(0,0,0,.02)`, deepening to `0 4px 12px rgba(0,0,0,.05)` on hover. Border **and** shadow together — the border does the separating, the shadow only lifts. Never a coloured left border. Never a gradient fill.

### Shadows

Deliberately shallow. Full ladder: `0 2px 8px /.02` card · `0 4px 12px /.05` card hover · `0 4px 15px /.03` table · `0 1px 4px /.05` kanban card · `0 8px 24px /.12` context menu · `0 10px 30px /.15` dropdown · `0 4px 16px /.25` tooltip · `4px 0 24px /.05` nav drawer · `0 1px 3px /.18` flags. Nothing heavier. There is **no inner-shadow system**; the only inset-like effect is the focus ring, `0 0 0 3px rgba(90,0,255,.12)`.

### Borders

`1px solid --gray5` is the universal divider. `--lightBorder` (#bdbdbd) for dialog and toggle edges. Table headers get a heavier `2px solid --gray5`. Outline buttons and the kanban add-athlete button use `1.5px`; ghost drop targets use `2px dashed`. Active nav and conversation items get a `3px solid --lightPurple1` **left** border with the padding compensated by 3px so text never shifts.

### Interaction states

- **Hover — surfaces**: `--surface-hover` (#f9f9f9) on rows and menu items; `--light` on drawer items; `--lightPurple4` on outline buttons.
- **Hover — coloured buttons**: no colour change; a shadow appears (`0 4px 12px rgba(0,0,0,.05)`). On the purple AppBar and inside the split monitor button, hover is an overlay instead — `rgba(255,255,255,.1)` on purple, `rgba(0,0,0,.1)` on filled controls.
- **Hover — text/links**: colour shifts to `--lightPurple1`; `view-all` links underline.
- **Press**: no scale, no translate. The system's documented press effect is a `ripple` keyframe (`scale(0)→scale(4)`, opacity `.5→0`, 0.55s) — nothing shrinks or bounces.
- **Focus**: never an outline. Always the 3px purple ring at 12% (or red at 12% on error fields).
- **Active/selected**: `--lightPurple4` fill + `--lightPurple1` text + a **transparent** border replacing the grey one, so the box size is identical to the resting state.
- **Disabled**: white fill, `--gray3` text, `1.5px solid --gray5`. In dark mode: transparent fill, `rgba(255,255,255,.2)` border, `rgba(255,255,255,.3)` text.

### Motion

Two easings only: `ease` for everything small, `cubic-bezier(0.4, 0, 0.2, 1)` for anything that travels (drawer, monitor button). Durations: **180ms** tooltips, **200ms** buttons and shadows, **300ms** inputs, cards, drawers, **350ms** tab content, **500ms** scroll reveals.

Motion vocabulary is fades and short slides — `fadeInAnim` (0.35s), `slideDown` (translateY −12px), `slideUp` (translateY 24px), `selectionSlideDown`, `navIndicator` (scaleY 0→1). Loading is a 0.7s linear `spin`. Decorative loops exist only in hero/marketing contexts: `float` / `floatB` (9–14s orb drift), `shimmer` (4s gradient sweep), `gradientShift` (18–20s), `pulse` (2s glow), `chipPop`. **Nothing bounces. Nothing overshoots. Nothing springs.**

Scroll reveals use an Intersection Observer with `.reveal` → `.reveal.visible` (opacity + 20px translateY, 0.5s) and stepped delays `.1s`–`.4s`.

### Transparency and blur

Used in exactly three places, all documented:
1. **On the purple AppBar** — the search field and user pill are `rgba(255,255,255,.1)`, lightening to `.2` on focus. The field never turns opaque white.
2. **Scrims** — `rgba(0,0,0,.5)` behind dialogs; the NavDrawer overlay adds `backdrop-filter: blur(4px)`.
3. **Tints** — `rgba(90,0,255, α)` for active states and empty-state circles; `rgba(255,255,255,.2)` hairlines inside coloured controls.

There are **no frosted-glass panels** and no protection gradients — text never sits on an image, so no scrim-under-text pattern exists. Overlaid labels are handled with solid capsules (`Badge`, `StatusPill`) instead.

### Dark mode

Real, and token-driven: `body[data-theme="dark"]` rewrites the same custom properties, persisted in `localStorage` as `footlink_theme`. Surfaces become `#1e1e2d` on a `#151521` page; borders `#2b2b40`. Two traps to remember:
- **`--darkPurple1` flips to `#ffffff`** because the app uses it as a text colour. Anything using it as a *background* (hero, sidenav, dark sections) must hardcode `#09001a`.
- **The AppBar does not change.** `#5a00ff` in both themes.
- Active states invert: `--segment-active-bg` goes from `--lightPurple4` to `--lightPurple1`, with white text.

---

## Iconography

**One icon system for all interface actions: Material Design Icons, via `react-icons/md`.** Filled style, 24×24 viewBox, `fill: currentColor`, rendered at 14–24px. There is no custom icon font and no sprite sheet. The full documented set:

- *Navigation* — `MdArrowBack`, `MdChevronLeft`, `MdChevronRight`, `MdExpandMore`, `MdExpandLess`
- *Actions* — `MdSearch`, `MdAdd`, `MdEdit`, `MdDelete`, `MdFileDownload`, `MdSend`, `MdFilterList`, `MdSwapHoriz`
- *State / feedback* — `MdVisibility`, `MdCheckCircle`, `MdNotifications`, `MdInfo`, `MdWarning`, `MdClose`
- *UI controls* — `MdMoreVert`, `MdList`, `MdCalendarMonth`, `MdSettings`, `MdAccountCircle`, `MdLogout`

Two documented exceptions: the kanban card trash uses `HiTrash` from `react-icons/hi`, and the `MonitoringButton` uses Font Awesome-derived eye/check/list glyphs (present as inline paths in `design_system.html`).

**Module icons are custom SVGs**, 30×30 viewBox, `fill="none"` with white strokes, tinted per module via a class on the parent: `feed.svg`, `search.svg`, `clubs.svg`, `competition.svg`, `agents.svg`, `marketanalysis.svg`, `transfermarket.svg`, `dashboard.svg`, `network.svg`, `chat.svg`, `language.svg`. Only one of these was recoverable from the mount — `dashboard.svg`, the Footlink ball mark, saved as `assets/footlink-mark.svg`.

**Stat-column icons are PNGs** in the real app (`src/assets/ico/ico-tempo.png`, `ico-jogos`, `ico-titular`, `ico-banco`, `ico-gols`, `ico-amarelos`, `ico-amarelo-vermelho`, `ico-vermelhos`, plus `notebook.png` for match reports). None were in the mount. The athlete-detail mock renders the same concepts as inline stroked SVGs plus solid card rectangles (`#F2C94C` yellow, `#EB5757` red) — the UI kit copies those inline paths verbatim from `detalhe-atleta.html`.

**Flags are images, never emoji or unicode.** Nationalities come from the app's own CDN at `https://storage.googleapis.com/rdf_static/flags/4x3/{cc}.svg`; the language picker uses three local PNGs. Sizes: 18×12, 20×14, 18, 25, max-30, 64×64. All get `box-shadow: 0 1px 3px rgba(0,0,0,.18)`.

**No emoji. No unicode glyphs as icons** — with two narrow exceptions carried over from the source: the `⇅ ↑ ↓` sort indicators in table headers, the `✕` dialog close, and `•` as an inline separator in the athlete header. Everything else is an SVG.

---

## Gaps and substitutions

These are the honest holes. **Please send the missing files and I'll wire them in.**

1. **Font files.** The source loads Barlow from Google Fonts and ships no local binaries, so `tokens/fonts.css` reproduces that `@import` exactly. This is faithful, not a substitution — but it means the design system has no self-hosted webfont. If you want offline/self-hosted Barlow, send the `.woff2` files and I'll write real `@font-face` rules.
2. **Module icons.** 10 of the 11 `src/assets/ico/menu/*.svg` files were not in the mount. The UI kit and the NavDrawer card use Material equivalents (`MdDashboard` for Feed, `MdSearch` for Busca, and so on) at the correct module colours. **These are stand-ins — send `src/assets/ico/menu/` and I'll swap them.**
3. **Stat-column PNGs.** `ico-tempo`, `ico-jogos`, `ico-titular`, `ico-banco`, `ico-gols`, `ico-amarelos`, `ico-amarelo-vermelho`, `ico-vermelhos`, `notebook.png` are missing; the kit uses the inline stroked SVGs from `detalhe-atleta.html` instead, which is what that mock itself did.
4. **Language flags.** `br-flag.png`, `uk-flag.png`, `sp-flag.png` are missing; `Flag` falls back to the CDN SVG at 18×12.
5. **Club crests, federation logos, athlete photos.** All placeholders from `logodetimes.com`, Wikipedia and `pravatar.cc` — exactly as the source mocks used them. No real club or athlete assets are included.
6. **Screens with no layout in the sources.** Meu Feed, Clubes, Análise de Mercado, Mercado de Transferências, Agências, Relatórios PRO, Perfil and Configuração are described in `DESIGN.md` only as grid patterns. They are deliberately not recreated rather than invented.
7. **Favicon.** `index.html` references `/Vector.svg`; the file was not in the mount.
