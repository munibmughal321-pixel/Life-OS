# LifeOS workspace

Use `lifeos/` for application development. `misc/` preserves earlier versions and private local reference material; it is not part of the application or deployment.

## Testing preview and feedback

An Android testing APK has been rebuilt from the current source. Read the [tester guide](docs/TESTING.md) for installation, sample workflows, and feedback instructions. Public sharing is pending a Git-history privacy cleanup; no hosted web link is verified yet. The repository remains private until that cleanup is approved and completed.

Fresh verification on 2026-09-27: web artifact checks, all 24 serial tests, Android compilation, APK signature, and byte-for-byte comparison of all 65 packaged web files passed. Real email/SMTP delivery, native callbacks, physical-phone checks, and iOS compilation remain open. Current account changes add numeric email-code entry and account-specific dashboard names; the hosted confirmation template still needs configuration.
## Folder map

- `lifeos/`: active HTML, CSS and JavaScript application, Supabase modules/migrations, Android/iOS projects, tests and Vite build.
- `docs/`: product requirements, architecture, phase guides and handoff evidence.
- `misc/separated-baseline/`: untouched copy of the selected baseline.
- `misc/original-single-file/`: original single-file application.
- `misc/intro-login-prototype/`: earlier introduction/login prototype.
- `misc/node-server-prototype/`: earlier Node version and its separate history/private runtime files.

## Current status

Phases 1 through 4 have browser implementations:

- Responsive tracker UI and all six modules.
- Validated IndexedDB persistence, backup/recovery and offline app shell.
- Supabase accounts, private profiles/records and account management.
- Separate device/account workspaces with explicit opt-in cloud synchronization, revisions, tombstones and conflict review.

Phase 5 adds Capacitor native adapters and Android/iOS source. The Android debug APK has been built and verified; physical-phone testing and iOS compilation remain outstanding. Phase 6 includes Netlify configuration and release-artifact checks; hosted deployment and public release remain pending. A GitHub Actions workflow is preserved locally, but uploading it requires the GitHub login to grant workflow permission.

Run and test from `D:\Munib\LifeOS app\lifeos`:

```powershell
npm run dev
npm run build
npm test
```

Development opens at http://127.0.0.1:4183. Production preview uses `npm run preview` and http://127.0.0.1:4184. These origins have separate browser storage; export/import a backup when intentionally moving data between them.

See [Phase 2](docs/PHASE2.md), [Phase 3](docs/PHASE3.md), [Phase 4](docs/PHASE4.md), [Phase 5](docs/PHASE5.md), and [Phase 6](docs/PHASE6.md) for setup, recovery, native builds and acceptance boundaries.

## Private archive and deployment

The archived Node version contains local data/auth files and old Git history. Preserve it locally. The root `.gitignore` excludes archives, credentials, Supabase CLI metadata, dependencies, build output, screenshots and private exports.

The root `netlify.toml` sets base `lifeos`, build command `npm run build:deploy`, and publish directory `dist`. Configure the LifeOS project URL and publishable key in the hosting environment before building. Never publish this workspace root or `misc`. No production deployment has been performed from this work.

## Next work

Test the Android debug APK on a real phone, complete a real two-profile/device Supabase sync drill, verify real confirmation/reset emails and redirect allowlists, configure public SMTP, and review the leaked-password-protection warning. iOS compilation requires Mac/Xcode access. Follow Phase 6 for a controlled web preview and the remaining public-release gates.
