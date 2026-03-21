# AGENTS.md

## Cursor Cloud specific instructions

**CookieCut** is a zero-dependency, client-side-only recipe builder. There is no package manager, build step, test framework, or linter.

### Architecture

- `index.html` is a minimal shell; `app.js` (ES module entry point) fetches HTML partials from `partials/` via `fetch()` and injects them into the DOM at runtime, then wires up event listeners.
- JS is split into native ES modules under `js/`: `state.js` (data), `dom.js` (DOM refs), `constants.js`, `helpers.js`, `global.js` (init), `builders/classic.js`, `builders/inline.js`, and per-item-type handlers in `handlers/`.
- `partials/imports.html` is a reference file and is **not loaded at runtime**; all CDN imports live in `index.html`'s `<head>`.

### Running the app

A static HTTP server is **required** (not `file://`) because `app.js` uses `fetch()` to load partials:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chrome.

### Key caveats

- All external assets (Tailwind CSS via Play CDN, Google Fonts, Material Icons) load from CDNs at runtime. Internet access is required.
- There are no automated tests, no lint config, and no build command. Verification is manual-only via the browser.
- State is in-memory only (`recipeData` in `js/state.js`); nothing persists across page reloads.
- CI: `.github/workflows/preview.yml` deploys PR preview channels to Firebase Hosting (project `slf-cookiecutter`). No build step runs in CI — raw files are deployed directly.

### Post-commit PR checks

- After each commit/push, check for new feedback from DeepSource and SonarCloud.
- Review both types of feedback: review comments and normal PR comments.
- Check the full PR checks/status list and confirm all checks are passing.
- If any check fails, investigate and fix the issue, then commit/push again and re-check until everything passes.
- After creating a PR, attempt to mark it as ready for review.
- If the PR is based on an issue, include `resolves #<issue_number>` in the PR description.
