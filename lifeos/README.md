# LifeOS — Separated Project Structure

The original single-file LifeOS app is organized into dedicated files for easier maintenance and future updates.

## Structure
- `index.html` — page shell and script loading
- `css/styles.css` — all styles/theme variables
- `js/config.js` — constants and presets
- `js/state.js` — application state
- `js/storage.js` — persistence and migration
- `js/utils.js` — shared calculations/helpers
- `js/ui.js` — modal/toast helpers
- `js/dashboard.js` — dashboard/header/24h arc
- `js/activities.js` — activity and sleep tracking
- `js/deen.js` — prayer/Quran/Adhkar/Jumu’ah/Ramadan
- `js/growth.js` — education/skills/goals/trading/vault
- `js/finance.js` — finance/loans/recurring expenses
- `js/me.js` — profile/check-ins/journal/review
- `js/app.js` — navigation/render/init

## Active working copy

This folder is the maintained application. The untouched baseline and other prototypes are preserved in `../misc/`. Keep the HTML, CSS, JavaScript files, and existing script loading order together. The icon is preserved in `assets/icons8-favicon-50.apng.png`.

## Local preview limitations

No build system or framework was added during organization. Opening `index.html` can be used to inspect the interface, but this is not a verified functional run: `js/storage.js` depends on the nonstandard `window.storage` API, which ordinary browsers do not supply. Loading may fall back to defaults and saves may fail. Browser persistence must be repaired before relying on this application for daily records.

The favicon link in `index.html` still references `icons8-favicon-50.apng`, which does not match the preserved asset path. Fixing that reference is the next implementation step alongside persistence; no application code was changed in this preparation.

## Development and deployment

Make future feature changes here. Treat `../misc/` as local reference material, not production source. Do not run the archived Node server as a substitute backend. Future hosting must build this folder and publish only its generated `dist/` output, once that build pipeline has been introduced. No deployment is configured yet.
