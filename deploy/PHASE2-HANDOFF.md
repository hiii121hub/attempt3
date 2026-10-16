# Phase 2 checkpoint and next-session plan — October 13, 2026

Latest session: **read `PHASE3-HANDOFF.md` first**. Phase 3 verified and repaired
missing-server audio publication, added bounded/owned FFmpeg startup cleanup,
and implemented a tested offline container-lifecycle slice. Six real Chrome-tone
process-cold rounds passed (three before, three after the repair); the original
20.530-second cold timeout's cause is still unknown. Current automated total is
240 passing runner results. Production isolation, audible client playback and
five sustained active viewers remain unverified. This supersedes the resume order
below without removing historical evidence.

Latest focused sprint: read `SPRINT-2026-10-13.md` first. Isolation specification
checkpoint `a0cb3a9`, capacity/normal-teardown checkpoint `5dc928c`, and Linux smoke
harness/diagnostics checkpoints `3cdb998` / `5ed57c0` are pushed on this branch.
Current automated result: **196 passed**; warm Linux cap-one recovery/admission,
stream probes and shutdown cleanup passed, but the earlier cold audio probe timed
out. Five connected users, full audible/video playback, production isolation and
eligible permanent free hosting remain **NOT VERIFIED**. See `SERVER-ACCEPTANCE.md`
for the hosting/release gates. The older results and next-session plan below are
historical and must not override this newer report.

Later retest: see `PHASE2-LIVE-TEST.md` for a real Linux VNC-readiness failure rollback, subsequent Chrome launch and authenticated stream probes at application commit `85d8a6b`. The original checkpoint results below are retained as historical evidence.

Branch: `fix/phase2-reliability-isolation`, based on `d9819526039a3a8c1810ab3a9f3b37482608688c`.
Work directory on Mac: `/Users/haythammutan/Documents/Codex/2026-10-12/poxey-x1-project-handoff-project-overview/attempt3-audio-fix`.
Repository: https://github.com/hiii121hub/attempt3.
The checkpoint is committed and pushed on this branch; use `git log -1` for its exact commit. No main merge or public deployment is authorized.

## Completed in Phase 2

- Verified that bounded launch retries are already present from commits `18da2b3` through `c68a792`. Did not duplicate the implementation. The 17 helper tests and 6 App launch tests still pass, including five independent simulated clients, cancellation, cold-start timing, exhaustion and non-retryable failures.
- Fixed missing startup rollback for PulseAudio sinks in Chrome-window, resize and VNC failure paths. A resource owner now tracks the attempt's directory, sink and child processes. Its `finally` cleanup also runs for unexpected exceptions, attempts TERM then KILL, removes the sink/profile, and releases the startup lock/device reservation. Cleanup continues across individual cleanup errors and reports aggregate failures.
- Successful startup transfers resource ownership only after session/token publication. A token-file publication failure removes the unpublished session from the map and runs startup rollback.
- Added child spawn-error handling and log descriptor closure on process close, including synchronous spawn errors.
- Added a read-only Linux isolation prerequisite checker and 11 rejection/qualification tests. It starts no containers or Chrome sessions.
- Added the concrete per-session rootless Podman design, adapter contract, host prerequisites and 12 Linux acceptance tests in `isolation/IMPLEMENTATION.md`. The production runtime adapter/container image are **not implemented or verified** without the target Linux environment.

## Files changed relative to d981952

- `scripts/poxey-session-manager.mjs`
- `scripts/startup-resources.mjs`
- `scripts/startup-resources.test.mjs`
- `package.json` (test/check commands only; no dependency changes)
- `deploy/README.md`
- `deploy/isolation/preflight.mjs`
- `deploy/isolation/preflight.test.mjs`
- `deploy/isolation/IMPLEMENTATION.md`
- `deploy/PHASE2-HANDOFF.md`

No frontend, CSS, noVNC, audio-worklet, touch, browser dimensions, VNC routing, timer constants, dependency lockfile or existing production authorization policy changes were made in Phase 2. Normal session-end cleanup and usage accounting retain their existing implementation.

## Actual verification

| Check | Result |
|---|---|
| `npm run test:reliability` | PASS: 11 tests, including failure-stage resource rollback, idempotency, success ownership, cleanup-error continuation, real profile deletion with ledger/other-profile preservation, and a real owned Node child termination |
| `npm run test:isolation-plan` | PASS: 11 host prerequisite policy tests |
| `npm run test:security` | PASS: existing 39 policy/static deployment tests |
| `npm run test --workspace frontend -- --run` | PASS: 26 tests |
| `npm run test --workspace worker -- --run` | PASS: 77 runner results, including existing JS/TS duplicate suites |
| `npm run frontend:build` | PASS: same CSS/JS artifact names as the previous checkpoint |
| `npm run worker:build` | PASS |
| `node --check scripts/poxey-session-manager.mjs` and `git diff --check` | PASS |
| `npm run check:isolation-host` on this Mac | EXPECTED NOT READY, exit 2: macOS, no qualified rootless Podman/cgroup/user-namespace environment |

Total: **164 automated runner results passed**. The startup failure-stage tests inject failures at the resource-ownership layer; they are not real Chrome/PulseAudio failure tests. No new three/five-viewer benchmark, video playback, audible audio, 25-minute runtime or Linux sandbox test occurred in Phase 2. Production dependencies were unchanged; the prior zero-production-vulnerability audit and development-tool advisories remain recorded in `VALIDATION.md`.

## Codespace preservation check

The user reopened the original Codespace in Safari. Read-only checks showed:

- Directory `/workspaces/attempt3`, branch `fix/audio-service-startup-v2`, HEAD `c68a792`.
- Existing modified `package-lock.json`: 0 added / 48 removed lines.
- SHA-256 `8a115555d554d555d4aaa9e183a0e8891b3857c2abb174a4419678b020cd56ea`, matching the earlier preserved hash.
- A two-second curl to manager `/health` returned no response. Services were not restarted and no Chrome sessions were created.

Do not switch/pull the original Codespace over its modifications. Continue locally, or use a new checkout for Linux verification once its compute budget is approved. Existing backups and changes remain untouched.

## What is and is not proven

- Simultaneous launches: the fix is implemented and local regressions pass. Earlier live evidence: five real concurrent creations, 19 busy responses recovered, all five created in 22.1 seconds on the warm rerun; a cold run completed creation in 46.5 seconds. This is historical development evidence, not a new Phase 2 runtime test.
- Connected viewers: previous evidence reached three. Five connected active viewers remain unverified. Ten created Chrome sessions is not a measured active-user limit.
- Audio/video: earlier user playback and stream-token probes are not a new human-confirmed multi-user playback test.
- OS/network/X11/PulseAudio isolation: **not implemented or verified**. The existing native stack still shares a Linux account, network and PulseAudio server. Public untrusted multi-user release remains blocked.

## Next session: exact order

1. Read this file and `isolation/IMPLEMENTATION.md`. Run `git status --short --branch`, `git log -3 --oneline`, then fetch remote state. Preserve changes. Continue this branch; do not redo the completed launch fix or overwrite the Codespace lockfile. Check account usage before substantial work; at the last check the five-hour window was 83% used and weekly window 41% used. Those values are historical, not a current balance.
2. Confirm the actual October 15 Student benefit, no-card Linux VM eligibility, quota and spending protection. No offer has been activated or suitable free permanent host proven. Do not create paid resources. Obtain the qualified Linux environment and run `npm run check:isolation-host` as its dedicated non-root account. The checker passing permits prototyping only.
3. Implement the container runtime adapter and worker image under the contract in `isolation/IMPLEMENTATION.md`; verify nested Chrome sandbox, private X11/PulseAudio, restricted egress and cgroup limits before connecting untrusted users. Run ISO-01 through ISO-10 and real startup-failure tests. Keep the native development adapter intact.
4. Validate unchanged allowance/cleanup and production Safari cookie reconnect. Then run three and five actual connected viewers with real interaction, permitted video and human-confirmed audio for 15–20 minutes, respecting the timer. Measure resources and stop on pressure. Run ISO-11/ISO-12 and determine a safe cap from actual measurements.
5. Review outstanding development dependency advisories separately. Commit/push every completed tested checkpoint and update this handoff before usage is exhausted. Public deployment and main merge still require explicit approval.

The user personally needs to confirm Student benefit activation/eligible hosting and participate in audible browser playback verification. No code-copying or cleanup/reset commands are required from them at this checkpoint.
