# Results B and nickname moderation verification

Implemented the approved B layout in the existing blue/lavender theme. Desktop results use a 1,100 px dialog with an overview and a separate submission/status column; narrow screens stack the content. Header and footer actions remain reachable at 1280 × 720 and 390 × 844. Overview, timeline and mistakes tabs retain real score data, English WPM/CPM explanations, compatible personal-best comparisons, bounded observed process samples, mistake drills, course/assessment results, continuation, status recovery and sharing. The fixed `visitor` segment is outside the suffix input; final name validation remains authoritative on the server.

The administrator page imports the pinned LDNOOBW/Wordnik Chinese (318) and English (403) source lists. Filtering starts disabled with no selected languages. Each pack supports search, pagination, enabled states, matching-mode editing, adjacent-X deletion and adding terms. TXT/JSON imports deduplicate and allow explicit merge/replace; JSON/TXT exports preserve attribution. Saving uses revision conflicts and the existing administrator identity/navigation guards. Server enforcement covers registration, changed public names and score publication; blocked submissions remain retryable. Existing account access, unrelated profile updates and historical scores remain intact.

Leaderboards default to all difficulties and all periods, retain individual stages and explicit shared-URL selections. Theme controls use accessible sun/moon icons. Brand links return home while protecting unfinished practice or administrator edits. Feedback can close while keeping the form draft.

## Validation

- TypeScript, production build, emitted Vercel ESM import and Sites packaging checks passed.
- Full Vitest run: 810 passed, 48 environment-gated PostgreSQL tests skipped, one existing paused-draft restoration case timed out during concurrent CPU-heavy jobs. An isolated rerun passed all 12 line-practice cases and both process-chart cases; no restoration implementation change was needed. Updated submission, nickname, administrator, locale and race tests also passed.
- Real disposable PostgreSQL: 14 integration checks passed, covering explicit additive policy installation, initial disabled seed, concurrent-save conflict, cross-instance/restart reads, API/profile behavior and nonempty SQLite/PostgreSQL backup round-trip. Original migration checksums are unchanged.
- Browser checks passed for desktop/short-window/mobile layouts, nickname prefix and limits, Chinese/English theme presentations, admin add/delete/import/export/persistence, real WPM/CPM help, personal bests, mistakes, ranking controls, recovery, moderation status and PNG download/clipboard sharing.
- A process-chart browser selector was updated to select the full Timeline tab rather than matching both the overview preview and hidden full chart. A share test affected by rebuilding its running static directory passed when rerun against the completed build.

## Deployment

Install the independent nickname-policy extension explicitly in the selected environment using the documented operator command or guarded build flag. The idempotent seed never overwrites administrator configuration. Clear the installation flag after the successful build; leave the feature off and language selection empty for the administrator to enable later. No dependency, protected Sites file, database URL, SMTP credential or context checkpoint is included in this change.
