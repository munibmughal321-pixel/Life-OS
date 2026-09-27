# LifeOS architecture

Updated: 2026-09-22. Requirements: [PRD.md](PRD.md). Status and evidence: [MEMORY.md](MEMORY.md), [PHASE3.md](PHASE3.md), and [PHASE4.md](PHASE4.md).

## Current implementation

LifeOS is a multi-page HTML, CSS and JavaScript application built with Vite.

- `index.html` is the public introduction; `welcome.html` stores device-local onboarding preferences.
- `dashboard.html` is the six-module tracker. Its feature scripts remain classic globals loaded in a deliberate order.
- Login, signup, recovery, reset and account pages use Supabase Auth through ES modules.
- `js/storage.js` stores validated collection envelopes in IndexedDB. `js/backup.js` provides versioned backup preview, atomic restore and recovery checkpoints. `js/offline.js` owns the generated offline app shell.
- `backend/repository.js` is the authenticated Supabase profile/record boundary. Postgres RLS enforces owner isolation and revision-checked writes.
- `js/sync-storage.js`, `backend/sync-engine.js`, `backend/sync-remote.js` and `backend/sync-page.js` implement Phase 4 account-local workspaces and opt-in synchronization.

## User and data flow

```text
Signed out -> lifeos-local IndexedDB workspace
Signed in  -> lifeos-account-<user UUID> IndexedDB workspace

Form action -> domain validation -> atomic local transaction -> UI save success
                                           |
                                           +-> optional sync trigger
                                               -> verify current Auth owner
                                               -> paginated cloud pull
                                               -> three-way reconciliation
                                               -> revision-checked writes
                                               -> atomic local acknowledgement

Conflicting edit/delete -> preserve both copies -> user chooses local or cloud
Downloaded change       -> durable local commit -> explicit reload prompt
```

Signing in never uploads the device-only workspace. Moving that history requires an explicit local backup export and import into the account workspace. The import is a visible replacement operation and retains its recovery checkpoint.

## Folder responsibilities

```text
LifeOS app/
|-- docs/                    Product, phase, architecture and handoff guidance
|-- lifeos/                  Active app and npm working directory
|   |-- *.html               Public, auth, account and dashboard pages
|   |-- backend/             Supabase client, repositories, auth and sync modules
|   |-- css/                 Shared and page styles
|   |-- js/                  Classic tracker modules and local adapters
|   |-- scripts/             Verification and sequential test runners
|   |-- supabase/            Versioned migrations and Edge Function source
|   |-- tests/               Node and isolated Edge regression suites
|   |-- vite.config.mjs      Build and generated offline-shell configuration
|   |-- dist/                Generated output; never hand-edit or commit
|-- misc/                    Local-only archives and old private runtime data
|-- .gitignore               Private/generated/archive exclusions
|-- README.md                Workspace entry point
```

## Technology choices

| Layer | Choice | Current state |
| --- | --- | --- |
| Interface | HTML, CSS, JavaScript | Implemented; classic tracker order preserved |
| Build/offline shell | Vite and generated service worker | Implemented and browser-tested |
| Browser storage | IndexedDB | Phase 2 complete; device and account databases are isolated |
| Accounts/cloud | Supabase Auth and Postgres | Phase 3 implemented; real email/redirect acceptance remains |
| App-data sync | Supabase records plus local reconciliation | Phase 4 browser implementation complete |
| Browser testing | Node test runner and isolated Edge/Playwright contexts | 14 tests across six files pass serially |
| Native storage/package | SQLite adapter and Capacitor 8.5.2 | Source/adapters implemented; native builds/device acceptance pending |
| Hosting | Netlify from GitHub | Account linked by user; production deployment unverified |

Exact dependency versions live in `package.json` and its lockfile. The current application does not need a frontend framework rewrite.

## Local storage and synchronization contract

All 19 tracker collections use validated version-1 envelopes. Local writes finish before success is shown, and stale-tab revisions are rejected. A recovery-store `sync-state` entry holds the enabled preference, last acknowledged cloud rows, conflicts and last successful sync time. Pending work is derived by comparing current local records to that baseline, so there is no second queue that can drift from the saved collections.

List records use existing IDs or dates, daily maps use date keys, and singleton settings use `settings`. Invalid, duplicate or oversized identities stop sync. Full merged collections are decoded and validated before any upload.

Reconciliation distinguishes missing, deleted and active states. Independent changes merge. Same-record edits and edit/delete races retain both copies until the user chooses. Choices include the reviewed payloads and remote revision, so a later cloud edit invalidates an old choice. Deletes are revision-checked updates with `deleted_at`; authenticated clients have no direct hard-delete permission on tracker rows.

Remote pulls use collection-by-collection keyset pagination. The authenticated owner is checked before and after every response and immediately before local acknowledgement. An account change locks the old page. Web Locks serialize sync attempts on the same origin, and IndexedDB compare-and-swap checks prevent a response from overwriting a newer local form save.

An expired or temporarily unreachable Auth session pauses cloud work while the remembered account database remains available locally. The remembered UUID selects storage only and grants no cloud access. Logout clears the selection but retains that account database. Account deletion warns that the database cannot be reopened through a deleted identity and requires backup acknowledgement.

## Security boundaries

- The browser receives only the Supabase project URL and publishable key. Service-role credentials remain in the Edge Function environment.
- RLS and `auth.uid()` enforce cloud ownership. Client validation improves feedback but is not authorization.
- `misc/`, environment files, Supabase CLI metadata, dependencies, build output, screenshots and private exports are ignored.
- Local IndexedDB data and downloaded backups are not encrypted. Use trusted browser profiles.
- Supabase leaked-password protection is currently disabled and remains a public-release review item.

## Native and release boundaries

Phase 5 adds Capacitor Android/iOS sources, a native SQLite adapter and device-local arrival reminders. Each workspace is an atomic revision-checked SQLite document preserving collection envelopes and recovery/sync metadata. Auth secrets use Keystore/Keychain; browsers retain IndexedDB. See [PHASE5.md](PHASE5.md). Background delivery, permissions, reboot behavior and battery limits require real Android/iPhone testing; browser checks cannot prove them.

Build from `lifeos/` with `npm run build`. Netlify should use `lifeos` as its base and publish only `dist`. Never publish the workspace root, `misc`, credentials, test fixtures or backups.

A successful build and mocked browser transport do not prove live email delivery, a real two-device Supabase workflow, real-phone behavior or production deployment. Those gates remain recorded in [PHASES.md](PHASES.md).
