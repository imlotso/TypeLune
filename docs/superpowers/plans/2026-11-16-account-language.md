# Account interface-language implementation plan

> Native execution in the existing isolated branch; independent read-only review. User delegated routine implementation choices. No production deployment or remote push.

## Goal and design

Add an interface-language selector to settings and make the existing header toggle use the same preference. Guest preferences remain browser-local. Signed-in preferences use the existing owner-scoped workspace settings protocol on SQLite and PostgreSQL, including the Vercel adapter. An absent preference follows the browser without any automatic write.

Use optional `ReaderSettings.uiLocale: 'auto' | 'zh' | 'en'`; do not add it to defaults or migrate old records. `auto` explicitly restores browser detection. A nested account-aware I18n provider consumes the existing workspace, never the guest localStorage key. Both practice and administration must bind it. Preference writes happen only after explicit interaction and merge with the latest local settings. Loading with no account cache disables changing language; cached offline edits retain the normal revision/generation conflict protections. Old async callbacks are scoped to the original owner/provider instance.

This builds on the current React/TypeScript/Fastify workspace code, rather than a separate account API or second synchronization mechanism. Portable practice presets stay independent of interface language. UI copy remains concise; changes do not remount a current practice round.

## Steps

- [x] Write failing provider, selector and validation tests: account-vs-guest, no default writes, loading guard, save failure, late callback, old payload and invalid enum.
- [x] Add pure locale types/validation, optional client/server settings field, and account-scoped provider; bind practice and admin without a duplicate workspace hook.
- [x] Add selector (`auto`, `zh`, `en`) and shared header behavior/error state; preserve current practice input and language.
- [x] Verify real browser flows on disposable SQLite: two browser contexts, delayed initial sync, guest/account switching, offline cached edits/retry, no-cache failure, and stale remote conflict preservation. Capture actual desktop/mobile settings.
- [x] Verify PostgreSQL API/handler persistence without a schema change. Independent Docker verification must name its actually tested candidate; do not substitute host HTTP results.
- [x] Run typecheck, full unit/integration suite, relevant then full browser regression, build and Sites tests. Record failures/fixes, request independent review, save screenshots to Library, and commit only implementation/evidence files.

## Review focus

1. Browser fallback never creates settings that replace unread cloud settings.
2. Guest localStorage events do not change a signed-in account; logout restores the guest preference.
3. An old account's delayed save, error or GET cannot change the new account's language.
4. Failed durable writes show failure; network failure preserves the locally saved preference and honest sync status.
5. Old settings remain valid; invalid language is rejected by both local and server validators. Competing revisions cannot silently overwrite each other.
