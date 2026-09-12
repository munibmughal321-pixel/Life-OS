# LifeOS workspace

Use `lifeos/` for all future application development. `misc/` preserves earlier versions as reference material; it is not a deployable application.

## Folder map

- `lifeos/`: active copy of the feature-rich separated application, plus the existing icon in `assets/`.
- `misc/separated-baseline/`: untouched original of the selected baseline.
- `misc/original-single-file/`: original `lifeos_v3.html`.
- `misc/intro-login-prototype/`: earlier welcome/login/dashboard prototype, archived intact.
- `misc/node-server-prototype/`: earlier Node version, including its existing Git history and local files, archived intact.

## Current status

This preparation changes organization and documentation only. Application HTML, CSS, and JavaScript have not been changed. The workspace root now continues the existing Life-OS Git history, with the active application under lifeos/. No build system or deployment has been configured.

The active application still depends on the nonstandard `window.storage` API. Ordinary browsers do not provide this API, so reliable saving requires a follow-up fix. Its favicon link still points to `icons8-favicon-50.apng`; the preserved asset is now `assets/icons8-favicon-50.apng.png`. The link repair is also deferred. Opening the HTML is not proof that persistence works.

## Private archive and hosting

The Node archive contains local `auth.json` and `data.json`, and a nested `.git` directory. Preserve them locally; do not upload or deploy this archive. Its server does not adequately protect data endpoints or private files. The intro/login prototype's browser-local password storage is not production authentication.

The root `.gitignore` excludes `misc/`, local credentials/data, dependencies, and build output from this repository. The archive folders listed above are local-only and intentionally absent from GitHub; earlier committed code remains accessible through Git history. Ignore rules do not remove files already recorded in existing Git history, and they do not control what a hosting provider publishes.

For future hosting, use `lifeos/` as the application base and publish only its generated `dist/` directory once the build pipeline exists. Never publish this workspace root or `misc/`. There is no deployable build yet.

## Next step

Repair browser persistence and the favicon reference, then verify existing workflows locally before adding the production build and cloud integrations. The archived Node repository remains separate; the root repository preserves its existing commits without rewriting history.
