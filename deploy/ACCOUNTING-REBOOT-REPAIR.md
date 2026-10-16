# Reboot recovery repair — October 15, 2026

## Verified live diagnosis (read-only)

Safari on the Mac opens the original `redesigned-capybara` Codespace, directory
`/workspaces/attempt3`, engineering HEAD `a9f5ba1`, not the newer Codespace
shown in the user's Windows photos. Its only reported local modification is the
existing package-lock file; SHA-256 remains
`850709a6fbebc884821ec320d72b85eda33cf1236caa7f5d8511f9c10a6863d6`.

The persistent state has a blocked manifest and intact ledger, owner-only
permissions, and no key. No secret environment override is configured.
The old gate is October 15, 21:32:35.483 UTC; the current boot does not match.
Wall-clock expiry alone cannot validate an interrupted same-boot quarantine.
No Chrome/Xvfb/x11vnc/FFmpeg processes were found and ports 3997/3999 had no
listeners. Forwarded-port labels were stale, not proof of active services.

Ledger and original archive copy match SHA-256:
`d80b7d27289d702adaaea905c0838193cf57e4dd4885dd64b34c92acb3f70c4f`.
No records, identities, keys or browser history were displayed.
The old recovery archives, manifest, profile data and lockfile were not changed.

A fresh bounded workspace search found two keys in separate owner-development/
demo directories, not the protected original directory. Both available manifests
reported ready state with different ledgers and zero currently unexpired records;
a third matching directory was incomplete/unreadable to the summary check.
These are not proof that the original key was recovered. Their keys were not
printed, copied or selected. Their purpose and any other Codespace usage must
be reviewed before establishing a new recovery observation.

## Implemented solution

- Read-only `status` diagnoses reboot, waiting, missing/damaged state,
  interrupted activation and readiness with redacted metadata.
- Startup's fail-closed error points to that diagnostic command.
- Explicit `reobserve` copies verified blocked state to a new private directory
  after idle-host checks. It preserves old state and gate, refuses ambiguous
  contents or overlapping/populated destinations, and creates no key.
- A new full 24-hour interval is enforced after re-observation. No automatic
  activation, clock override, unsigned-cookie acceptance or allowance reset.
- Existing startup/authentication, timers, cleanup, UI, audio and routes remain.

## Live status and blockers

This code does not recover the original key or make the old wait valid again.
The user must identify the intended Codespace and account for other running copies
before live re-observation/configuration. No new live recovery gate or signing
key has been created in this repair. No original checkout synchronization or
live startup is claimed yet. The original host remains blocked rather than
granting fresh identities using incomplete evidence.

See [the recovery procedure](IDENTITY-RECOVERY.md). Public release is still not
authorized or proven safe. Tests use isolated synthetic state, never real ledgers.

## Offline verification

Mac final: 342 tests passed (273 backend, 28 frontend, 41 worker), zero failed/skipped;
both builds and syntax/whitespace checks passed. The 16 new recovery tests cover
redacted read-only status, exact source preservation, fresh deadline, permissions,
early activation refusal, clock jumps, further reboot, ambiguous files, key/ready
source rejection and invalid/overlapping/occupied destinations.
The convenient read-only `npm run accounting:status` selects the same state
configuration as startup, so no placeholder path or HTML-like syntax is required.

The first focused run had three sandbox uptime-access failures. Diagnostics were
changed to query uptime only when needed inside error handling; all 51 focused
accounting/startup/reboot cases then passed. No cases were excluded.
No live activation or Chrome/audio playback test was performed.

## Linux verification of committed code

At code commit `8bdb61809273e9c9ed0b3dd17a5da60a93b099f4`, created a separate
detached worktree at `/workspaces/poxey-reboot-verify-8bdb618`, sharing the
already-installed dependency directory through a symlink; no installation or
original lockfile rewrite. Node v24.21.0 ran all 52 accounting/startup/reboot
tests: 52 passed, zero failed/cancelled/skipped (about 2.33 seconds).
These tests exercised synthetic state, not the original accounting records.

From that new checkout, explicitly selecting the original directory for the
read-only status command returned `RECOVERY_BOOT_CHANGED`,
`ledgerVerified: true`, `admissionReady: false` and the unchanged old deadline.
The original `/workspaces/attempt3` remained on its old engineering branch.
The separate verification worktree is retained for review; it is not a live
server or an automatically selected accounting destination.
