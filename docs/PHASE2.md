# Phase 2: local data and offline guide

Completed for the web implementation on 2026-09-15. Cloud accounts/sync and native apps remain later phases.

## Run the app

Open a terminal in `D:\Munib\LifeOS app\lifeos`:

```powershell
npm run build
npm run preview
```

Open **http://127.0.0.1:4184/dashboard.html** in Chrome or Edge. Keep the preview terminal running for normal local use. Wait for **Ready for offline use** before testing disconnection. The first visit needs the server; the saved app can subsequently reopen at that same address without a connection while its browser cache remains available.

For source editing use `npm run dev` at **http://127.0.0.1:4183/dashboard.html**. Development deliberately does not install an offline worker. Ports are separate to prevent a cached build from masking source edits. If dependencies are missing, run `npm ci` in the `lifeos` directory first.

Local records belong to the exact browser profile and origin (protocol, host and port). The 4183 development address, 4184 preview address, localhost instead of 127.0.0.1, and a future hosted domain each have separate data. Move data using a backup, not by copying browser files. Stay on the same address for regular testing.

## Daily saving

Forms wait for an IndexedDB transaction to commit before reporting success. A transaction is an all-or-nothing database operation. Failed saves keep form inputs, restore the last saved in-memory value, and show an error. Duplicate clicks are blocked during pending transactions.

All 19 tracker collections are covered: logs, prayers, quran, finance, loans, recurring, checkins, profile, goals, skills, education, notes, journal, mission, courses, adhkar, jumuah, ramadan and trades. Known fields are checked for type, dates, numeric ranges, nested lists, duplicate IDs and session timing. Safe additional JSON fields survive for compatibility; unsupported versions or malformed collections block writes rather than being overwritten with defaults.

Activity changes read the current database records inside a transaction. Open-ended sessions continue using their saved start timestamp. Overdue scheduled sessions finish at their planned timestamp when LifeOS next opens. A closed browser is not a reliable alarm.

Other collections reject stale-tab revisions. If another tab changes the same collection, preserve the form's text elsewhere and reload before retrying. There is no cloud synchronization or account isolation in this local-only phase; anyone using this browser profile can open its workspace.

## Backup and restore

Open **Backup & recovery** near the top of the dashboard.

- **Download backup** exports the committed database, not unfinished form input. Keep the JSON outside the browser. It contains private information and is not encrypted.
- **Preview a LifeOS JSON backup** accepts up to 10 MB. Preview shows current and incoming counts; nothing changes until the replacement checkbox is checked and **Restore this backup** is pressed.
- Restore replaces the full tracker snapshot atomically. It does not append or merge, so repeating the same import cannot duplicate entries. Importing an older backup intentionally restores its older values.
- If another tab or a timer changes data after preview, restore is refused. Preview again. If quota or storage errors occur, the whole restore and its checkpoint roll back.
- **Preview data from before the last restore** allows undoing the most recent replacement. One prior snapshot is kept on the same device. A subsequent restore replaces this checkpoint with the data immediately preceding it. This is not a substitute for an external backup.
- **Export raw recovery data** downloads current database envelopes and supported legacy tracker keys, even when their records fail validation. **Export the previous recovery copy** retrieves the last checkpoint for diagnosis if it cannot be imported normally. Raw recovery files are not accepted as normal backups.
- Welcome interests/priority/time preferences stay in their separate browser-local preference store and are not in tracker backups. The profile and its learning preferences are included. Credentials/tokens are never included.

Backup format: `{format:"lifeos-backup", version:1, createdAt:<ISO timestamp>, collections:<all 19 collection values>}`. Record envelopes/revisions are local concurrency metadata and are regenerated on restore.

## Earlier LifeOS data

Existing IndexedDB collection envelopes retain version 1; the database upgrades to version 2 only to add the recovery store. Valid `lifeos.sessions.v1` localStorage sessions migrate when the logs collection is absent, without deleting their source. Once logs exist, even as an empty list, old sessions are not reimported automatically.

**Preview older browser data** reads only `lifeos_data_<collection>` keys at the current origin. It never imports prototype login credentials. Legacy JSON files may contain an object keyed by supported collection names; supplied collections replace the current versions, and omitted collections retain current data. The original source is untouched. Invalid legacy content is rejected.

Data owned by the old nonstandard `window.storage` host cannot be discovered from another origin. Export it there as collection-keyed JSON before importing. There is no automatic migration across browsers, ports or hosted domains.

## Offline files and updates

The production build generates `sw.js` with a content-derived cache version and a complete allowlist of app files. The worker caches only application assets; it never caches arbitrary API/auth requests or personal records. External fonts may fall back to local system fonts offline.

Updates install separately and wait while an old LifeOS tab remains open. The app never forces a reload. When the update notice appears, finish or save drafts, close all LifeOS tabs, and reopen. IndexedDB records are not removed by app-cache updates.

**Request storage protection** asks the browser to reduce automatic eviction; the browser decides whether to grant it. Browser/site-data clearing, profile removal or device loss can still erase both local records and cached files. Private/incognito mode is not suitable for keeping records. Use external backups.

## Verification and practice

From `lifeos/`:

```powershell
npm run build
npm test
```

The suites serve only `dist` and use isolated Edge test profiles. They do not open or modify your normal browser data. Automated checks cover all collection create/edit/delete round-trips, real forms, failed-save drafts, corrupt/unknown data, quota rollback, conflicting tabs, import validation and repeat imports, legacy migration, recovery checkpoints, a full browser-process restart offline, open-ended/overdue sessions, local-midnight calculations, all-page offline reopening and safe app updates. The backup dialog also has a 320px overflow check and screenshot review.

Practice with sample data:

1. Start an open-ended activity; refresh and confirm it is still running.
2. Add a journal entry and download a backup.
3. Wait for the offline-ready message, close the browser, disconnect, and reopen the same preview address.
4. Finish the activity offline and refresh to check it remains finished.
5. Preview the earlier backup, inspect the counts, and restore it. Then preview the pre-restore recovery copy to undo the replacement.

Real Android/iPhone durability and operating-system reminder behavior belong to Phase 5 testing. Public authentication, cloud syncing, deployment and store submission are not implemented by this phase.
