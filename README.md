# The Forbidden World

A front-end-only campaign wiki for D&D players (Open Eyes & Crescent Hills),
hosted via GitHub Pages. Pure HTML/CSS/JS — no backend, no build tooling
required to run it.

## Phase 1 status (this delivery)

- [x] Folder scaffold
- [x] SCSS foundation (variables, base, buttons, header/nav, home sections)
- [x] Compiled CSS
- [x] Responsive header: hamburger dropdown (mobile) → sidebar (desktop),
      shared across every page via a small include system
- [x] Home page, matching the approved mockup
- [x] Stub pages for all 6 other nav destinations, so every link works
- [x] Footer with credit / GitHub / WotC attribution

Not yet built: the card data system, popups, and real page content
(Sessions, Quests, NPCs, Locations, Factions, Campaigns) — that's Phase 2+.

## Running it locally

The header and footer are loaded into every page at runtime via
`fetch()` (see `js/include.js`), so the site **must be served over
http**, not opened directly as a `file://` URL — browsers block
`fetch()` of local files for security reasons.

Easiest options:
- VS Code: install the "Live Server" extension, right-click
  `index.html` → "Open with Live Server"
- Or, with Node installed: `npx serve .`
- Or, with Python installed: `python3 -m http.server 8000`, then visit
  `http://localhost:8000`

This matches how GitHub Pages actually serves the site, so if it works
locally with a server, it'll work once pushed.

## Editing the styles (SCSS → CSS)

`css/main.css` is the file the pages actually load. It's currently
**hand-compiled** from the `.scss` source files, since this environment
didn't have a Sass compiler available to generate it directly. Going
forward, edit the `.scss` files and recompile:

1. Install Sass once: `npm install -g sass` (or use the VS Code "Live
   Sass Compiler" extension, which watches and recompiles on save)
2. Compile: `sass scss/main.scss css/main.css`
3. Or watch continuously while you work: `sass --watch scss/main.scss:css/main.css`

If any `.scss` file and `css/main.css` ever disagree, the `.scss` is
the source of truth — recompile.

## Folder structure

```
index.html            Home page
quests.html            } stub pages, one per nav destination —
session-recaps.html    } real content comes in later phases
npcs.html               }
locations.html          }
factions.html            }
campaigns.html            }

partials/
  header.html          mobile top bar + hamburger dropdown + desktop sidebar
  footer.html          credits / GitHub / WotC attribution

scss/                  SCSS source (edit these)
  _variables.scss      colors, fonts, breakpoints
  _base.scss           resets, typography, .placeholder ("???") rule
  _buttons.scss
  _header.scss         header, nav, sidebar, footer
  _home.scss           home page sections + hero/campaign bar styles
  main.scss            imports all partials — compile THIS file

css/main.css           compiled output — pages load this, don't hand-edit

js/
  nav-links.js         single source of truth for nav — add a page here
                        and it appears in both mobile + desktop nav
  include.js            fetches header/footer partials, builds nav,
                        wires up the hamburger toggle

assets/
  logo-d20.svg          standalone copy of the d20 mark (the header/
                        sidebar use an inlined copy so `currentColor`
                        recoloring works — see note below)

data/                  empty for now — Phase 2 adds the card JSON files
                        here (campaigns.json, sessions, npcs, etc.)
```

## Notes on the logo SVG

`currentColor` only works when an SVG's markup is inlined directly into
the HTML (which is what `partials/header.html` does) — it does **not**
work if you reference the file via `<img src="assets/logo-d20.svg">`,
since the browser treats that as an opaque image and won't apply page
CSS to it. Keep using the inlined copy for anywhere the icon needs to
change color (e.g. matching campaign accent colors later); the file in
`assets/` is there as a clean source copy for reference/favicon use.

## Adding a new page later

1. Add a line to `NAV_LINKS` in `js/nav-links.js`
2. Create the new `.html` file at the project root, copying the
   `<head>`/include/`<script>` boilerplate from any existing page
3. Give `<body>` a unique `data-page="..."` matching the `page` value
   you used in step 1 — that's what drives the active-link highlight

No other file needs to change — this is the "expansion-proof" pattern
the whole card/data system will also follow from Phase 2 onward.
