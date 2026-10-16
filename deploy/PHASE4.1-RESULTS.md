# Phase 4.1 engineering checkpoint — October 14, 2026

**Implemented, tested and integrated; real identity activation remains BLOCKED.**
No public deployment or five-active-user readiness claim. The evidence does not
yet support calling the requested 80% milestone complete.

## Completed implementation

- Replaced silent missing-key generation and missing/corrupt-ledger empty-state
  fallbacks with explicit private accounting-state validation, in both modes.
- Added a protected recovery manifest with blocked/activating/ready phases,
  checksums, exclusive random-key creation, durable atomic writes and exact-key
  interrupted-activation recovery. Startup never prepares or activates recovery.
- Added an explicit Linux operator CLI with idle-host checks. For an incomplete
  backup, it requires every known window to expire plus a full 24-hour quiet
  recovery interval. Both wall time and same-boot elapsed uptime must satisfy the
  interval; a forward clock jump, reboot or ambiguous state refuses activation.
- Original development startup now discovers persistent
  `/workspaces/.poxey-state/attempt3` without changing `npm run dev`. Production
  retains explicit `POXEY_STATE_DIR`. State cannot be inside Git or `/tmp`.
- Missing/insecure/replaced state blocks startup before Pulse/Vite/listeners.
  Runtime HTTP health/admission returns 503 and WS upgrades refuse invalid state.
- Invalid/duplicate/malformed browser cookies return 401 instead of silently
  creating replacement identities. Existing valid cookie format is retained.
- Ledger commits cannot remove existing records, reduce usage within a window,
  or prematurely renew it. Crash ambiguity retains the newer ledger and blocks
  admission instead of rolling consumption back.
- Live cold-audio/capacity harnesses require explicit disposable accounting
  storage, not the real-user default. No expensive live Chrome test was run.

## Original Codespace evidence

The original checkout began at `8b298fd0455f5cea0a0f1e4c0c5a834e390a7564`, with only
the previously modified lockfile. The Mac began at remote `72292fb`. Application
checkpoint `731e8f267ccbffe48131b91c6f1b70e8766c1172` was committed/pushed,
verified with `git ls-remote`, then integrated with `git pull --ff-only` into
`/workspaces/attempt3` on `fix/phase2-reliability-isolation`. Documentation-only
checkpoints follow; use `git rev-parse HEAD` to identify the containing checkpoint.

The existing recovery archive `/workspaces/poxey-phase4-backup.3BVWya` remains
untouched. A new private checkpoint
`/workspaces/poxey-phase4.1-checkpoint.5z1ha5` preserves the current lockfile,
binary local-change patch, focused Linux test/build log, blocked-startup log and
the complete blocked accounting directory. No backup was overwritten/deleted.
The original lockfile SHA-256 stayed
`850709a6fbebc884821ec320d72b85eda33cf1236caa7f5d8511f9c10a6863d6`.

The original key was not recovered. The environment override was absent.
Repeated filename-only searches of authorized persistent workspace/config/state
locations found no key; inaccessible/unknown external backups are not excluded.
The surviving populated ledger passed strict schema/timestamp validation for all
records. Aggregate inspection confirmed an outstanding window; no identifiers,
cookie values, secret values or browsing history were displayed. Actual user
records/consumption and their file contents are not included in Git.

`/workspaces` is mounted ext4 workspace storage. The older backup survived the
observed environment restart; no deliberate host restart was performed this
sprint. Workspace persistence is not protection from Codespace deletion.

The approved **prepare** command completed on the original idle Linux host:

- `/workspaces/.poxey-state/attempt3`: codespace-owned 0700.
- Exact ledger copy and blocked manifest: codespace-owned 0600.
- `cmp` proved byte identity with the untouched source before/after both negative
  runtime checks. SHA-256 checks also matched; no allowance was reset.
- No replacement signing-key file exists.
- `notBeforeUTC`: **2026-10-15T21:32:35.483Z**, October 15 at 4:32:35.483 PM
  America/Chicago (CDT). This is a minimum gate, not automatic activation.
- Actual premature CLI activation refused with exit 1; no key was created.
- Actual original `npm run dev` refused with exit 1 / `IDENTITY_STATE_BLOCKED`.
  Ports 3997/3999 had no listeners afterward; ledger/key state was unchanged.
- The operator preparation/activation preflight found no live session processes,
  Poxey sinks or leftover legacy runtime state. No session/profile was deleted.

The service is intentionally stopped. No new identity was issued. Old signatures
cannot currently be authenticated because their key is missing; they were not
accepted or automatically replaced. Eventual approved rotation explicitly
invalidates them, after protected windows expire. Obsolete-cookie removal needs
informed user action then; no automatic clearing/reconnect was added.

## Tests (not live browser acceptance)

| Focused group | Mac passed | Original Linux passed | Final failed/skipped |
|---|---:|---:|---:|
| Accounting state and real-process startup refusal | 36 | 36 | 0 / 0 |
| Security and deployment guards | 43 | 43 | 0 / 0 |
| Capacity and teardown | 11 | 11 | 0 / 0 |
| Startup rollback | 11 | 11 | 0 / 0 |
| Audio readiness and owned capture | 25 | 25 | 0 / 0 |
| Frontend launch/heartbeat/pagehide | 28 | 28 | 0 / 0 |
| Total distinct focused tests | **154** | **154** | **0 / 0** |

Mac and Linux are separate executions of the same tests, not 308 distinct tests.
An initial deployment-test assertion had a syntax error; it was corrected, then
the affected suites passed before the implementation commit. No failing test was
excluded. Accounting fixtures are synthetic/disposable, never the surviving
ledger. Positive key generation/activation was tested only in those fixtures.

Coverage includes valid persisted state/fresh-process restart, missing secret,
ledger/manifest, corrupted/malformed records, permissions/symlinks, bad cookies,
unexpired/expired boundaries, clock jumps/boot change, interrupted activation
before/after key creation, interrupted accounting commit, independent identities,
monotonic consumption and temporary-profile deletion. Existing capacity tests
cover five reservations versus six and 100 simultaneous attempts, including
slot retention/release on failed startup and process termination. This is not a
five-viewer performance test or a real-service reboot with live sessions.

Frontend and worker production builds passed on both platforms. Frontend assets
remain `index-DLy7q3rK.css` / `index-C4Sp4kB9.js`; no frontend/worker/CSS/VNC proxy,
Chrome-size/touch/audio-playback source changed. Backend syntax, shell syntax and
Git whitespace checks passed. The worker test suite, expensive Chrome diagnostics,
real container tests and dependency audit were not repeated; old results must not
be described as fresh passes from this sprint.

**Blocked/not run:** successful real-user startup, real Chrome/VNC/audio streams,
audible playback, interactive Mac/Chromebook input/refresh, full-duration timer,
host reboot persistence with real identity state and five active viewers. Their
execution would bypass the present recovery gate. No behavior regression appeared
in the focused tests; changed operational behavior (intentional) is fail-closed
startup and 401 for invalid/obsolete cookies.

## Exact files changed in this sprint

1. `scripts/accounting-state.mjs` — private durable state, migration, accounting, signatures.
2. `scripts/accounting-recovery.mjs` — explicit idle-Linux operator CLI.
3. `scripts/accounting-state.test.mjs` — synthetic accounting/fault regression tests.
4. `scripts/accounting-startup.test.mjs` — real-process negative startup tests.
5. `scripts/poxey-session-manager.mjs` — consume validated state, reject bad identities, guard health/WS.
6. `scripts/security-policy.mjs` — persistent development path/override validation.
7. `scripts/security-policy.test.mjs` — persistent-path regressions.
8. `scripts/deployment.test.mjs` — wiring/preflight regressions.
9. `scripts/start-project.sh` — accounting preflight before dev services.
10. `scripts/start-production.sh` — production accounting preflight.
11. `scripts/test-audio-cold.mjs` — require isolated disposable accounting.
12. `scripts/test-capacity-smoke.mjs` — require isolated disposable accounting.
13. `scripts/test-original-integration.mjs` — follow configured persistent ledger.
14. `package.json` — focused accounting-test command; no dependency/lock changes.
15. `deploy/IDENTITY-RECOVERY.md` — operator recovery/persistence/failure procedure.
16. `deploy/README.md` — point existing deployment process at required state manifest.
17. `deploy/PHASE4-RECOVERY.md` — mark old report historical and link this checkpoint.
18. `deploy/PHASE4.1-RESULTS.md` — this evidence/handoff.

## Remaining gates and next session

1. After the recovery gate, independently recheck every relevant host/checkout,
   clock, boot, ledger and session resource before explicit activation. If the
   Codespace restarted or there is intervening/unknown usage, **do not bypass the
   boot check or edit the manifest**: preserve everything and review recovery.
   Do not burn scarce Codespaces credits keeping it awake solely for this gate.
2. After safe activation, test normal original startup, shutdown/restart and one
   private real viewer: Chrome, authenticated VNC/audio, audible playback, typing,
   pointer/scroll/touch and refresh-to-home with cleanup/accounting. Retest Chrome-
   book separately. No automatic reconnection or timer reset is permitted.
3. Separately finish production per-session isolation, qualifying free hosting
   and sustained five-active-viewer acceptance. Cookie deletion/new profiles
   remain distinct-identity bypasses; no absolute per-person limit is claimed.

The current shared OS account can read manager state; file permissions/checksums
are not a hostile-user boundary. Durable writes cannot reconstruct usage absent
from an old backup or a last unflushed heartbeat. A mid-ledger-commit crash blocks
startup and needs reviewed reconciliation; no automatic potentially lossy repair
was introduced. Off-host private state backups and a reviewed same-key legacy
import (if a key is later found) remain operational work.

**Startup decision: NO.** The original newest application command was personally
verified to refuse unsafe startup, not to start a usable website. Activation and
real viewer verification are outstanding. No merge, public exposure, Cloudflare
change, paid resource, production container claim or launch authorization occurred.
