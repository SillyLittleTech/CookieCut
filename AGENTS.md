# AGENTS.md

## Cursor Cloud specific instructions

**CookieCut** is a zero-dependency, client-side-only recipe builder. The entire app is 3 files: `index.html`, `app.js`, `styles.css`. There is no package manager, build step, test framework, or linter.

### Running the app
Serve the repo root with any static HTTP server:
```
python3 -m http.server 8000
```
Then open `http://localhost:8000` in Chrome.

### Key caveats
- All external assets (Tailwind CSS, Google Fonts, Material Icons) load from CDNs at runtime. Internet access is required.
- There are no automated tests, no lint config, and no build command. Verification is manual-only via the browser.
- State is in-memory only (`recipeData` object in `app.js`); nothing persists across page reloads.
