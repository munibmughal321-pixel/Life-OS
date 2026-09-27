# LifeOS active application

## Current implementation (2026-09-22)

This folder contains the maintained browser application:

- Phase 2: validated IndexedDB, backups/recovery and offline reopening.
- Phase 3: Supabase accounts, private cloud records, profile/export/logout/deletion.
- Phase 4: separate device/account workspaces and explicit opt-in synchronization with revisions, tombstones and conflict review.

For source development run `npm run dev` and open http://127.0.0.1:4183. For the production bundle run `npm run build`, then `npm run preview` and open http://127.0.0.1:4184. Run all regression files serially with `npm test`.

Read [Phase 2](../docs/PHASE2.md), [Phase 3](../docs/PHASE3.md), and [Phase 4](../docs/PHASE4.md) for exact workflows and remaining acceptance gates. The dated feature sections below preserve development history; this current section and the phase guides supersede older preview-only or “not connected” statements.

## Separated project structure

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

Use the Vite development or production preview server. Phase 2 provides IndexedDB persistence, external backups, atomic restore and offline reopening. See [the current Phase 2 guide](../docs/PHASE2.md) for exact commands and recovery steps; do not open HTML using file://.

Phase 1 fixed the favicon path, navigation labels, desktop/mobile layout, keyboard dialogs, field labels, editable profile name, and the timed refresh that previously replaced unfinished forms. The approved Monolith design uses near-black surfaces, lime accents, and CSS chrome artwork. All six modules, including Deen, have navigation buttons. New profiles start without personal salary or CGPA values. Phase 2 added persistent local saving; Phases 3 and 4 subsequently added accounts and opt-in sync without automatically uploading device-only history.

## Development and deployment

Make future feature changes here. Treat `../misc/` as local reference material, not production source. Do not run the archived Node server as a substitute backend. The Vite build includes the introduction, real account pages and classic dashboard scripts. Future hosting should build this folder and publish only `dist/`. No deployment was performed.

## Phase 1 manual checks

For current preview commands and addresses, use ../docs/PHASE2.md. Earlier temporary preview ports are no longer the run instructions.

1. Visit all six navigation screens on phone and desktop widths.
2. In Me, type a review and leave it for over a minute: the text should remain.
3. Set your display name and a salary of zero; update the profile and check the greeting. These are session-only changes until Phase 2.
4. Open Weekly Review, use Tab/Shift+Tab, and press Escape. Focus should return to its opening button.
5. Use test data only. Refreshing can lose session changes.

Verified in headless Edge: all six screens at 320, 390, 768, and 1366 pixels; draft preservation across the timer; dialog Escape; profile name and zero salary; JavaScript syntax. Screenshot visual review was blocked by the Windows sandbox helper, so appearance still needs your review.

## Monolith introduction and account preview

- `index.html`: introduction with feature overview and dashboard preview link.
- `dashboard.html`: existing six-module application, preserving classic script order.
- `login.html`, `signup.html`, `forgot-password.html`, `reset-password.html`: separate account screen previews.
- `css/public.css`: shared responsive public-page styles, including editable CSS chrome artwork.
- `js/account-preview.js`: native form validation, matching passwords, show/hide controls, and truthful preview feedback.

These forms do not authenticate, send email, verify reset tokens, or store credentials. Valid submissions clear password values and explain which backend operation has not occurred. The dashboard remains openly accessible as a preview. Supabase integration is a later phase.

### Run locally

From this folder, run `npm run dev`, then open http://127.0.0.1:4183/. If dependencies are missing, run `npm ci` first. Run `npm run build` for the production output, or `npm run preview` after stopping the dev server to inspect that output on the same port.

### Monolith checks completed

The production build passed. Headless Edge checked all six pages at 320, 390, 768, and 1366 pixels, plus navigation through all six dashboard modules at each width. Password mismatch, reveal controls, and all four form submissions passed. No form network writes, local/session storage writes, uncaught page errors, or missing assets were detected. Screenshot capture succeeded but image inspection was blocked by the local tool environment; final visual review remains manual.

## Workspace layout refresh

The dashboard clock is now a compact overview panel and is hidden on other modules. A collapsible preview notice keeps the session-only warning available without repeating a large banner. All modules have a title and description, with a desktop sidebar and mobile bottom navigation. Activities use labeled icon tiles; Growth has improved tabs and empty states. Shared dialog styling improves field spacing and action separation. Existing data models and storage behavior are unchanged.

Verified in headless Edge: six modules at 320, 390, 690, 768, and 1366 pixels without horizontal overflow; Growth tab switching; dashboard-only clock; Work start/stop; all ten activity choices in the dialog; Escape dismissal. Use the Chrome preview to review the final appearance.

## General-purpose goals

Goals separate the life area (Personal, Education, Career, Project, Health, Fitness, Deen, Reading, Routine, Savings, Other) from the tracking method. Use a measurable target with starting/current/target values and a unit; a checklist with checked milestones; or a completion-only outcome. Status remains manually editable. Numeric progress supports increasing and decreasing targets and is clamped to 0–100%; Done marks a goal complete. Routine goals count sessions, not automatic streaks.

Existing numeric goals remain editable without destructive migration. Dashboard main focus uses shared goal progress and unit helpers. Savings forecasts apply only to compatible savings goals. Persistent storage is still a later phase. Browser checks passed for creation of all three tracking methods, checklist editing, dashboard units, decreasing targets, and the form at 320/390/1366 pixels.

## Introduction inspired by Brain.fm

The introduction now uses a centered hero, purple gradients, selectable life-area previews, illustrated example cards, a three-step walkthrough and native FAQ disclosures. Original LifeOS copy and CSS artwork replace the reference brand assets. Illustrative values do not represent user data. Dashboard and account pages retain their existing styling and routes. Edit css/landing.css for this page and js/landing.js for preview selection. The production page passed four responsive widths, all six selectors, FAQ interaction and links to dashboard/signup/login.

## Matching account and dashboard styling

The four account previews and dashboard now load css/experience.css after their existing styles. It provides the shared violet palette, centered account form, original LifeOS ring emblem, grouped fields, light pill-shaped primary action and matching dashboard panels. Social sign-in buttons were not added because no providers are connected. Existing form validation and dashboard actions are preserved. Browser checks cover four widths, all six dashboard modules, goal dialog dismissal, password matching/reveal and signup preview feedback.

## Welcome setup and personal suggestions

Open welcome.html to choose multiple interests, one main priority, and a starting daily time commitment (10/20/30 minutes or decide later). Back preserves draft answers; the final review saves only after confirmation. Skip opens the dashboard without altering saved preferences. Introduction calls to action and account-preview links now lead to this setup; direct dashboard access remains available.

js/preferences.js owns the versioned lifeos.preferences.v1 localStorage key, validates stored values, and reports unavailable storage. It contains no credentials or tracker data. js/welcome.js renders the questions; js/personalization.js adds a suggestion card to the dashboard and preference controls to Me. The priority selects a starting action, interests provide shortcuts, and time is an intention rather than a timer or reminder. All modules remain accessible. Edit opens saved answers; Reset removes only this key and does not clear tracker data. Choices are local to the browser profile and origin, not synced to an account; using another port or clearing site data can make them unavailable.

Production browser checks passed: multi-select, empty-answer validation, Back, review, saving, refresh, editing, reset isolation, suggestion routing, all six modules, skip, invalid stored values, denied writes, and layouts at 320/390/768/1366 pixels. The production build passed. Tracker persistence and authentication remain separate unfinished work.

## Activity sessions

Selecting an activity now opens setup. Confirm a future local end date/time (up to 31 days ahead), or choose open-ended tracking. Presets supply 25 minutes, one hour, eight hours, or tomorrow. An optional intention, sound and browser-notification permission are available. Sessions start now; future start dates and repeating schedules are not implemented.

Scheduled sessions automatically record the planned end timestamp, even if the deadline is detected after the tab resumes or reloads. Open-ended sessions require check-out. Finishing saves the session before the optional review: Sleep offers quality/headache fields, other activities offer a rating and note. Skip dismisses the review without leaving the activity running. Completed-session cards offer simple next-step suggestions, not medical advice or an automatically started activity.

js/sessions.js stores activity logs only in lifeos.sessions.v1 localStorage and preserves them across refreshes on the same browser profile/origin. Preferences, accounts and other tracker data are separate. Invalid data and failed writes show errors without clearing stored records. Web Locks coordinate writes between supported same-origin tabs; without Web Locks, use one tab for session changes. Browser storage clearing removes this local history; cloud syncing is not connected.

Keep the page running for timely reminders. Background throttling, suspended devices, closed Chrome, and browser permissions can delay or prevent sound/notifications. A refreshed page may need another user action to enable audio. Notification construction is not supported by every mobile browser; in-app completion remains available. Do not use this as a dependable wake-up alarm. Completed sessions waiting for review appear on return (up to five at once; dismissing them reveals older pending reviews).

Checks passed: setup before start, invalid dates, scheduled/open-ended sessions, refresh recovery, exact automatic end timestamps, optional and skipped reviews, Sleep quality, failed-storage handling, responsive forms at four widths, concurrent starts and overdue reload. Notification permission denial and constructor calls were tested with a mock; real OS delivery and audible playback require manual Chrome testing. No Git commit or push was performed for this feature.

## 2026-09-14: Frontend handoff and first local-database slice

Current behavior supersedes the older preview-only storage notes above.

- All tracker collections now use IndexedDB (database lifeos-local, store collections). Preferences still use their existing localStorage key. No account data is uploaded.
- Existing lifeos.sessions.v1 records are copied into IndexedDB on first load if no logs collection exists. The source is retained. Corrupt/unknown data is blocked rather than reset.
- Saving waits for the transaction to finish. Failures keep the form draft and restore the last committed in-memory collection. Other-tab revision conflicts are reported instead of overwriting newer records.
- Activities support past logging and editing completed entries, overlap validation, optional linked goals, local-midnight daily totals and adding ten minutes before a timed session ends. Test reminder sound is available in session setup.
- Numeric goals may add linked completed hours or session counts to their manual baseline. Use unit hours or sessions to match the selected mode. Editing a linked activity recalculates progress rather than adding it twice. Checklist/completion goals remain manual.
- Dashboard priorities show the main focus and upcoming goals with review actions.

Run from the workspace root:
    npm --prefix lifeos run dev
Open http://127.0.0.1:4183/dashboard.html in Chrome. Keep the terminal running; save source changes to reload. Ctrl+C stops the server. If 4183 is already running, use its existing tab.

Verification:
    npm --prefix lifeos run build
    npm --prefix lifeos test

Tests run a temporary server serving only dist and isolated headless Edge browser contexts. They do not touch your normal browser records. Build first. They cover activity/goal flows, collection persistence, failed saves, conflicting tabs, legacy sessions, corrupt collection versions, overnight totals, and responsive navigation. Test screenshots are ignored by Git.

Phase 2 now adds record validation, versioned backup/export/import, offline loading, recovery and browser-restart tests; see ../docs/PHASE2.md. Browser data clearing still removes data. Real OS sound/notification delivery and real mobile devices need manual verification. Future scheduled starts, recurring sessions and pause/resume are not implemented. No Git commit, push or deployment was performed.

## Growth library redesign (2026-09-15)

Growth → Learning replaces Education while retaining existing academic records and graded courses. Learning preferences allow multiple paths and optional academic tools. Existing graded courses make academic tools visible by default; hiding them does not delete records. Learning entries support resource links, progress counts and optional deadlines. Older types such as FYP remain editable.

Skills now cover technology, communication, languages, creative work, career, everyday life, sport and custom skills. Level is self-assessed and starts as Not assessed. Existing XP/projects remain inside Optional legacy XP and projects. Practice logs record dates, minutes and notes; they are separate from timed Activities and do not automatically contribute to goals.

Vault supports entry types, templates, searchable text/tags, pins, archives, checklists and optional connections to learning/skills/goals. Use Show → archived to find and restore archived entries. Resource links accept HTTP(S). Replacing draft content with a template asks first. Existing notes retain their IDs and fields.

Implementation: js/growth-library.js owns shared forms and these three views; js/growth.js retains GPA, goals and trading; css/experience.css supplies responsive cards. New fields are optional additions to existing collections/profile, with no database version change. All saves use the existing transaction layer and retain drafts on failure.

Checks: npm --prefix lifeos run build, then npm --prefix lifeos test from the workspace root. Browser regression covers preferences/reload, book progress, nontechnical skills/practice, legacy records, Vault templates/checklists/search/archive, failed-save drafts, and four-width layouts/dialogs. Mobile/desktop screenshots were reviewed. No Git push, deployment, accounts or file uploads added. Phase 2 backup/offline/recovery is now implemented; see ../docs/PHASE2.md.

## Phase 3 accounts
Run `npm run dev` and open http://127.0.0.1:4183/login.html. Accounts are connected to Supabase; `account.html` contains cloud profile, export, logout and deletion. Email confirmation/recovery still require the redirect and email-delivery acceptance steps in [PHASE3.md](../docs/PHASE3.md).

## Phase 4 account workspaces and sync

The dashboard uses `lifeos-local` while signed out and `lifeos-account-<user UUID>` while signed in. Signing in alone never uploads device-only history. Enable sync from the dashboard when you want that account workspace to use Supabase. Local edits save first; conflicts retain both copies for review. Logout keeps the account database and pending changes for later sign-in. See [PHASE4.md](../docs/PHASE4.md) for migration, conflict, backup and testing instructions.

## Entry-page visual refresh (2026-09-24)

The supplied 47-second recording informed the introduction's structure: a floating navigation bar, split hero, interactive three-step walkthrough, feature-card grid, example workflows, FAQ and final signup call to action. LifeOS copy and CSS artwork are original; sample interface values are labelled illustrative and no testimonials, customer logos or unsupported product claims were copied.

Login and signup use the matching light lavender treatment and responsive split layout through css/auth-entry.css. Existing field IDs, validation, auth handlers, recovery links, offline hooks and native runtime imports are retained. The dashboard and account backend were not redesigned.

Edit index.html/css/landing.css/js/landing.js for the introduction; login.html/signup.html/css/auth-entry.css for the two account-entry screens. Build passed. entry-design.test.mjs verifies four widths, walkthrough buttons, FAQ, anchors, signup navigation, password reveal and confirmation validity. phase3-auth.test.mjs verifies existing account flows with mocked email transport. Desktop/mobile screenshots reviewed. No real emails or deployment were triggered.

Preview: npm --prefix lifeos run dev, then http://127.0.0.1:4183/ . Keep the terminal running. For a cached production preview, close all LifeOS tabs and reopen after the app announces an update.

## Phase 5 native apps

The Android debug APK has been built, its signature verified, and Android lint passed with zero errors. Windows Android Studio, SDK and JDK 21 are installed. Run `npm run native:doctor` to check the setup, `npm run android:build` to rebuild the APK, and `npm run android:open` to open the project in Android Studio. The Start Menu also contains **Android Studio (LifeOS)**. The active SDK folder is **D:\Android\Sdk**; choose that folder if Android Studio asks for the Android SDK location.

The generated APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to your Android phone and open it to install when ready. This is a development test build; physical-phone workflows, arrival delivery, native email callbacks and iOS compilation/device testing remain outstanding. See [the Phase 5 guide](../docs/PHASE5.md) for verified build evidence and the acceptance checklist.
