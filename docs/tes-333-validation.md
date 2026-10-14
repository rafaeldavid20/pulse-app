# TES-333 — validation and release order

The unread badge originally passed a Pulse UserProfile to a function requiring
Firebase User.getIdTokenResult. TypeScript rejected AuthGuard.tsx:112 with
TS2345 on 004a5dd. The corrected version uses auth.currentUser and verifies UID.
Notification listeners ignore callbacks after cleanup, recover on focus/online
without opening duplicate subscriptions, and clear workspace data on permission
errors. Queries remain restricted by user and authorized workspace.

Local validation on Node 22.23.2: TypeScript, ESLint, webpack production build,
and all 34 frontend tests passed. New tests include a claim arriving after
three seconds, multi-workspace claims, and an empty notification scope.
Domain types match the corresponding backend PR (hash 111a7c4e746e2db7).

Backend PR #99 adds seven real Firestore rule tests and a PR verification
workflow. Its 69 unit tests and 219 integration tests passed locally. No
production credentials are required for these emulator checks.

Both PRs now run a verify job without application secrets and retain
verify-output.txt. QA should review those results for the exact commit instead
of treating missing local dependencies as manual work.

Release order: verify both PRs, review corrected commits, merge/deploy, then
execute TES-352 against the deployed version. A production smoke test cannot
be executed on an unmerged version. TES-353 tracks the rule tests, which are
automated here; TES-352 preserves the actual deployment check.

Production smoke coverage must include workspace creation in an existing
session, Inbox/badge across authorized workspaces, and access revocation.
Do not claim the production smoke test passed based on local/emulator results.
The local browser preview could not authenticate: Firebase returned
auth/network-request-failed. Browser validation remains a separate requirement.
