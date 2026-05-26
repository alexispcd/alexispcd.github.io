# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

No test suite is configured.

## Architecture

**Cairn** is a personal PWA (Progressive Web App) — a launcher for small tools. It is a React 19 + Vite app styled with MUI v9 and deployed as a standalone PWA via `vite-plugin-pwa`.

### Routing

`src/App.jsx` is the root. It owns the `dark`/`setDark` state (persisted via `useDarkMode`) and a single MUI `ThemeProvider`. Each route maps to one self-contained app:

- `/` → `src/apps/home/Home.jsx` — grid of app cards
- `/cotes-run` → `src/apps/cotes-run/CotesRun.jsx` — the only active app

`dark` and `setDark` are drilled down as props to every route component so they can render a dark-mode toggle.

### Adding a new app

1. Create a directory under `src/apps/<app-name>/` with a root `<AppName>.jsx`.
2. Add a `<Route>` in `src/App.jsx`.
3. Add an entry to the `apps` array in `src/apps/home/Home.jsx` with `status: 'active'`.

### Theme

`src/styles/theme.js` exports a factory `(dark: boolean) => MuiTheme`. The primary color is forest-green (`#3d6b51` light / `#5a9e78` dark). Font is Geist for body text and DM Serif Display for titles. Do not override MUI component defaults without adding them to the `components` section of this theme.

### Côtes.Run — the hill-finder app

The app lets runners find nearby climbs by clicking on a map. It is structured as a phase state machine:

```
idle → placed → searching → results
```

**`useSearch.js`** — all async logic lives here. It:
1. Queries the **Overpass API** for OSM highway ways inside a bounding box.
2. Samples each way (up to 9 points) and sends batches of 100 to **open-elevation.com** for elevation data (1.5 s delay between batches to avoid rate limits).
3. Filters results by `minElev`, `minSlope`, and `minLen` from `DEFAULT_PARAMS`/`SLIDERS` in `utils.js`.
4. Sorts by slope descending and exposes results via the `useSearch` hook.

**`utils.js`** — pure helpers: `haversine`, `pathLen`, `samplePath`, `slopeColor` (color by slope %), and the `DEFAULT_PARAMS` / `SLIDERS` config used by both the hook and `FilterDialog`.

**`CotesRun.jsx`** — map UI using `react-leaflet`. Renders a CartoDB tile layer (dark or light variant), a center `Marker`, a dashed `Circle` for the search radius, and `Polyline`s for each result colored by slope via `slopeColor`.

**`ResultCard.jsx`** — slide-in card at the bottom of the map showing the active result. Supports swipe gestures via `framer-motion` drag.

**`BottomBar.jsx`** — context-sensitive action bar below the map (Search / Cancel / Reset buttons).

**`FilterDialog.jsx`** — MUI dialog with sliders driven by `SLIDERS` config from `utils.js`.

### Map tile URLs

Dark mode: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`  
Light mode: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`

### External APIs (no keys required)

- `https://overpass-api.de/api/interpreter` — OSM road/path data
- `https://elevation.racemap.com/api/v1/elevations` — elevation lookup (batch 500 points, no delay)

## Versioning

Version is in `package.json`. It is exposed to the app via `__APP_VERSION__` (defined in `vite.config.js`) and displayed on the Home page.

**Claude Code handles version bumps and commits.** Use semver: patch for fixes, minor for new features. Bump the version in `package.json` and commit with a short message matching the repo style (`type: short description`). After each commit, ask the user whether to push to `main`.
