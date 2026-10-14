# Phase 4 recovery checkpoint — October 14, 2026

Historical checkpoint below. Phase 4.1 implements automatic fail-closed guards
and the authorized recovery procedure in `IDENTITY-RECOVERY.md`; its results and
remaining activation gate are recorded in `PHASE4.1-RESULTS.md`. Do not use the
older startup/key-regeneration behavior described below as current instructions.

**Code integration verified; runtime/identity recovery BLOCKED. Do not launch the
original development service until the accounting recovery decision is approved.**
This is not a public-release or five-active-user acceptance report.

## Preserved engineering and original checkout

- Recovered and reviewed the exact 129 additions: `f1b85ba` contains 41 added lines
  in `frontend/src/sessionHeartbeat.test.ts`; `8b298fd` contains 88 added lines in
  `scripts/test-original-integration.mjs`. Both were already committed/pushed and
  present in the original Codespace, not merely a separate preview.
- Original `/workspaces/attempt3` was verified at `8b298fd0455f5cea0a0f1e4c0c5a834e390a7564`
  on `fix/phase2-reliability-isolation`, zero commits ahead/behind its upstream.
  The previous audio branch is an ancestor; its committed repairs are included.
  The final documentation commit should be retrieved with `git rev-parse HEAD`.
- Original local lockfile changes remain uncommitted: 48 removed optional-package
  `libc` metadata lines, carried through the earlier three-way branch switch.
  No conflicts, other tracked changes, or non-ignored untracked original files
  were reported. Active lockfile SHA-256 remained
  `850709a6fbebc884821ec320d72b85eda33cf1236caa7f5d8511f9c10a6863d6`.
- Verified recoverable backup outside the project:
  `/workspaces/poxey-phase4-backup.3BVWya`. Its readable archive includes the old
  checkout and `.git/HEAD`; old dependency folders, local patch and exact original
  lockfile are retained. Original lockfile SHA-256:
  `8a115555d554d555d4aaa9e183a0e8891b3857c2abb174a4419678b020cd56ea`.
- Linux preview worktree `/workspaces/poxey-phase2-smoke` remains detached at
  `c8c6fc0`; it was not deleted or made the primary startup directory. Mac
  engineering checkout is a separate repository. No main merge/force-push/reset.

## Stale-profile investigation and newly missing state

The interrupted run observed
`/tmp/poxey-sessions/b1e7e500-a991-47ef-a95e-36ebf386cc47`, owned by `codespace`,
directory mtime October 14 02:59 UTC. Earlier logs associated this UUID with old
manager shutdown. Process inspection found no Chrome/Xvfb/x11vnc/FFmpeg process,
manager health had zero sessions/slots, and Pulse showed only the idle default
sink. No profile contents, history, cookies, tokens or secrets were displayed.
Open-file ownership and successful quarantine were **not** established: the
attempted move used an incorrectly transcribed backup suffix, failed with no
change, and was not retried destructively.

On recovery, host uptime was about ten minutes and the entire
`/tmp/poxey-sessions` directory was absent, including the profile, ledger and
signing-key file. No Poxey listeners or browser/media processes were present.
This is consistent with environment restart/temporary-storage loss; it is not
proof that application cleanup removed the directory. The original profile can
no longer be inspected and has not been recovered. No manual deletion occurred.

Code review confirms a defect in the **old** branch: cleanup scheduled profile
removal after 1.5 seconds, but shutdown could call `process.exit(0)` before that
timer ran. This is consistent with the observed orphan, not a uniquely proven
forensic cause. The current engineering branch already awaits pending teardown
before normal shutdown; do not redo that repair. Abrupt host termination and
durable orphan recovery are separate, still-unqualified cases.

## Signing key: not recovered from accessible locations

- `POXEY_FREE_COOKIE_SECRET` presence was checked without printing its value:
  not configured in the original Codespace environment.
- Filename-only searches covered persistent `/workspaces` (including both
  worktrees/backup), accessible Codespace home/config/local directories and
  documented `/etc/poxey` and `/var/lib/poxey` locations. Named build/package/cache
  trees were pruned. Missing/inaccessible locations are not claimed searched.
- Configuration-definition searches printed filenames only; no configured
  override or archived key was found. Mac project/config/state searches also
  found no matching key file. These checks cannot exclude an unknown external
  backup or arbitrarily renamed/encrypted credential.
- GitHub's authenticated Codespaces page showed one Codespace only: the original.
  No additional Codespace was started or purchased to search for a copy.
- The surviving `usage.before.json` backup is readable, non-empty and checksummed.
  Its contents/identifiers/key material are deliberately excluded from Git.
  No usage record was reset, restored over another file, or edited.

`loadFreeCookieSecret()` uses the environment override, otherwise reads the
secret file, otherwise generates a new key. Cookies are `deviceId.HMAC`; a new key
rejects old signatures. `getOrCreateFreeDevice()` then creates a new device ID,
which can receive new allowance despite the preserved old ledger. The original
key cannot be reconstructed from the usage ledger. Current development state
defaults to `/tmp`; production requires persistent state outside `/tmp`.

**Do not run `npm run dev`, the cold-audio harness, or the live integration smoke
against missing identity state to manufacture passing results.** Keeping the
service stopped is the current operational fail-closed measure, not an implemented
automatic startup guard. Existing cookies remain in browsers but cannot be
validated without the old key. Cookie deletion can already evade device-based
identity; this sprint does not claim that abuse problem is solved.

## Available verification

Recovery runs (Mac engineering checkout; selected groups also confirmed again
in the original Linux checkout):

| Group | Passed | Failed / skipped |
|---|---:|---:|
| Heartbeat / pagehide regression | 5 | 0 / 0 |
| Capacity and teardown | 11 | 0 / 0 |
| Startup-resource rollback | 11 | 0 / 0 |
| Audio readiness/capture | 25 | 0 / 0 |
| Security/deployment | 41 | 0 / 0 |
| Total focused automated results | 93 | 0 / 0 |

Original Linux heartbeat/capacity/rollback reruns passed (27, not counted twice).
Audio/security reruns were also requested in the original Linux terminal, but
their final output was not yet observed when Safari moved to another chat; do
not claim that additional Linux rerun passed until its output is checked.
Original frontend and worker production builds passed. Frontend artifact names
remain `index-DLy7q3rK.css` / `index-C4Sp4kB9.js`. Production dependency audit:
zero vulnerabilities; prior full development-tool audit advisories are not
claimed fixed. Integration script syntax passes; no assertion was removed.

The prior integration smoke safely **failed its precondition** on the stale
profile before creating Chrome. Its complete live path has not passed. Earlier
Phase 4 started normal development services on 3997/3999 and rendered the
homepage; that was before temporary-state loss and is not a new recovery pass.
No fresh Chrome/VNC/audio-stream, audible playback, real viewer refresh,
full-duration allowance, five-viewer or real-container acceptance claim is made.
All forwarded ports were verified private. Services remain stopped.

No application/UI/CSS/Chrome-size/touch/audio/proxy/authentication/timer source
was changed during this recovery. Only this handoff was newly added.

## Approval-required recovery and next steps

1. Prefer recovery of the exact original key from a user-provided external backup.
   If found, verify it against an existing cookie without logging either value;
   migrate the exact key and ledger together to persistent storage outside Git and
   `/tmp`, directory 0700/files 0600. Codespace-specific storage could live under
   `/workspaces/.poxey-state/attempt3`; development code must first be explicitly
   wired to it (it currently ignores a development `POXEY_STATE_DIR` override).
   Production already supports `POXEY_STATE_DIR`. Never paste the key into chat,
   shell history, a commit or command output.
2. If no exact key can be recovered, request approval for an explicit migration.
   Keep the ledger unchanged and admission disabled. There is no trustworthy
   mapping from an unverifiable cookie alone to the old record. A conservative
   option is to keep **all** admission closed until every surviving allowance
   window has naturally expired, then perform an approved, disclosed key rotation
   into persistent storage while retaining historical records. Do not implement
   rotation or treat this proposal as authorization. Stronger account-bound
   identity requires a separate approved design, not unsigned-cookie acceptance.
3. Add/test fail-closed startup for lost key/non-empty ledger, persistent dev
   accounting and safe migration before restarting. Then run normal `npm run dev`
   in `/workspaces/attempt3`, verify process paths/ports/health, and run the bounded
   smoke plus the authorized Safari refresh/video/audio/keyboard/mouse tests.

Until identity recovery is resolved, the requested safe end-to-end startup answer
is **NO**. The original directory contains the latest engineering code, but is
not running it and is not safe to restart under the no-allowance-reset requirement.
Public release remains forbidden: real isolation, hosting, historical cold audio
reliability and sustained five-active-viewer acceptance remain open.
