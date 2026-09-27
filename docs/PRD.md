# LifeOS product requirements

Updated: 2026-09-13. Product direction is agreed; implementation remains incomplete.

## Purpose and target users

LifeOS is a customizable personal life organizer connecting activities, sleep, learning, finances, faith practices, and wellbeing. Everyday records must work offline. It is also a hands-on learning project: its owner should understand, debug, maintain, and extend the implementation.

Target users are students, self-directed learners, working adults (including night-shift workers), and people seeking a private overview of their routines and goals. Deen is optional for users who want Muslim faith tracking. The owner is the initial tester; the public product supports separate private accounts.

## First-release capabilities

| Area | Required behavior |
| --- | --- |
| Dashboard | Summarize the selected day, activities, and goal progress. |
| Activities and sleep | Start/end activities, edit records, review timelines, and restore timers after reopening. |
| Deen | Optional prayers, Quran, adhkar, Jumu'ah, and Ramadan tracking. |
| Growth | Goals, skills, education, courses, notes, and a manual trading journal. |
| Finance | Income/expenses, loans, recurring items, and savings progress; prevent duplicate recurring entries. |
| Personal wellbeing | Editable profile, check-ins, journal, and weekly review. |
| Accounts | Register, verify email, sign in/out, recover passwords, export records, and delete accounts. |
| Offline and sync | Local creation/editing/deletion across all modules; private cross-device sync with recoverable conflicts. |
| Native reminders | Optional arrival prompts at saved places; confirmation before creating an activity record. |

Onboarding must configure display name, currency, timezone, day boundary, and enabled modules without inheriting the developer's personal salary, grades, or routines. Disabling a module must not silently erase its records.

## Acceptance criteria

1. Save an activity offline, reopen the app, and find it intact. Running timers use persisted timestamps rather than requiring an interval to keep executing.
2. Edit/delete records on two devices, reconnect, and preserve all nonconflicting work. Conflicts remain recoverable; retries do not duplicate data or resurrect deleted entries.
3. Account A cannot read or change account B's cloud records. Switching accounts cannot expose another account's local cache.
4. Export a versioned backup, preview an import, and restore without erasing the source or duplicating repeated imports.
5. Arrival at an enabled native saved place may show a prompt; only confirmation creates a record. Permission denial leaves manual tracking usable.
6. All modules work at phone, tablet, and desktop widths with labels, keyboard access, visible focus, and readable contrast. Errors preserve unfinished input and explain recovery.

## Platform and quality requirements

- Web: responsive UI and planned installable/offline app shell after first successful load. Browser storage can be cleared; provide backup and storage-failure guidance.
- Android/iPhone: shared app packaged natively, with native storage and location integrations.
- Native phones support background arrival reminders subject to OS restrictions. Web offers explicit foreground location checking and manual controls.
- Account creation/recovery, initial cloud download, remote deletion, and sync require internet. Core local modules remain usable offline.
- Handle midnight, overnight activities, configurable day boundaries, timezones, and daylight-saving changes.
- No silent data loss, false save success, private data in logs, or privileged client credentials.
- Wellbeing and trading entries are personal records: no medical diagnosis, profit guarantees, or automatic trade execution.

## Exclusions and constraints

Defer AI coaching, smartwatch/health imports, automatic activity logging, live market feeds, subscriptions, social sharing, and separate native desktop apps. Preserve existing useful features; scope expansion requires an explicit decision.

Development uses free tools/services where practical. Available test resources are Windows and Android. Publication funding, iOS build access, real iPhone tests, and current store requirements are later gates. Do not promise unlimited free infrastructure or a fixed delivery date.

Target a coordinated web/Android/iPhone release after all gates pass; store review timing is external. Account setup or documentation completion does not authorize production launch.

## Related documents

[ARCHITECTURE.md](ARCHITECTURE.md) explains implementation; [RULES.md](RULES.md) governs work; [PHASES.md](PHASES.md) sets order; [MEMORY.md](MEMORY.md) records current state.
