# Resume on committed input (2026-11-16)

Scope: independent `dot/resume-on-input` from production/main candidate b6eec8d; no production configuration, database or deployment changed.

Behavior:
- Resume unlocks the active input while keeping local time and the online session paused.
- Focus, arrow/modifier keys, an unchanged value and uncommitted/cancelled IME candidates do not resume.
- A changed committed input (including a real correction/backspace) initiates the online resume request and then resumes the clock. Empty/no-op deletion does not start it.
- Edits while the request is pending are retained; a new composition in progress is preserved separately from committed/scored text. Pending input triggers the existing browser leave warning.
- Escape can cancel the armed waiting state. Existing draft, restoration, ownership, result and offline recovery paths remain in use.
- Initial start behavior is unchanged. `awaitingResumeInput` is exposed for concise bilingual button/status copy; no input placeholders were added.

Verification:
- Added failing tests before implementation: button idle time and cancelled/committed IME. They failed with the old immediate `running` transition, then passed.
- Five new hook tests passed, including deferred online response/fast edits, concurrent IME, correction and cancellation.
- Final affected hook/line/recovery focused run: 41 passed.
- Full default unit run: 667 passed, 39 skipped, three unrelated existing tests hit the 5-second timeout under concurrent local load (account-api password change, account-email change, postgres-operator missing target). Those three files rerun serially: all 13 tests passed. Earlier Windows sandbox SMTP failures were environmental (Git OpenSSL MSYS process object access); local-only SMTP tests passed outside that sandbox. Do not call the default full run an uninterrupted green run.
- TypeScript noEmit and production frontend/backend builds passed. Existing bundle-size warning remains.
- System Chrome: all 12 practice and resume-on-input browser cases passed after updating the old resume assertion to type before waiting for `/resume`. This includes a real local server, online start/pause/resume, IME event simulation and desktop/mobile existing practice coverage. OS-native IME candidate popup was not separately tested.
- Final integration should rerun aggregate tests and browser checks on the combined branch. No push, merge or deploy performed here.
