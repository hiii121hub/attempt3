# Phase 3 engineering results — October 13, 2026

**Measurable progress toward readiness, not verified 80% completion.** The sprint
repaired a reproduced audio-initialization defect, bounded capture startup/cleanup,
implemented an offline container lifecycle slice, and strengthened capacity tests.
Planning estimate: approximately **70–75% development readiness**, low confidence,
not a weighted/test-derived score. Security and public-release readiness remain
NO-GO because the deployment/isolation/five-viewer acceptance gates are open.

Started from actual clean local/remote `673ca98` on
`fix/phase2-reliability-isolation`, after reading all requested handoffs and existing
isolation/capacity/server-acceptance documents. Original Codespace stayed on its
old branch with its modified lockfile; Linux tests used `/workspaces/poxey-phase2-smoke`.

## Required status summary

| Area | Before | Now | Verified? |
|---|---|---|---|
| Cold-start audio | Unresolved | Missing-server publication repaired; ready sink/monitor required; capture deadline and owned termination added | PARTIAL: six process-cold Chrome-tone successes; historical cold timeout cause unresolved; audible client playback NOT VERIFIED |
| User isolation | Specification only | Offline create/inspect/start/rollback/stop/remove adapter implemented | PARTIAL: simulated Podman lifecycle tests and real harmless command-bound tests; actual containers BLOCKED |
| Five-user admission | Prepared | Failed fifth startup/duplicate cleanup preserves other reservations; default unchanged | COMPLETED focused regression; actual native cap-one Linux admission/cleanup passed |
| Five active connected viewers | Not verified | No new viewer-capacity claim | NOT VERIFIED |
| Session cleanup | Improved | FFmpeg captures tracked until close, with TERM/KILL and session teardown ownership | COMPLETED focused tests and Linux profile/sink/process checks; container crash recovery pending |
| 25-minute allowance | Preserved | Constants/accounting preserved; initial 1,500,000 ms and ledger retention checked | PARTIAL: full real-duration expiry/reboot not rerun |
| Hosting readiness | Checklist prepared | Existing checklist retained; exact Linux blocker documented | BLOCKED: no eligible target host/account or production-runtime qualification |

## A. Audio evidence, diagnosis and repair

The old 20.530-second Chrome startup / zero audio within ten seconds remains a
historical observed failure. No logs from its discarded FFmpeg process establish
the exact cause. Warm success and longer probe deadlines do not prove a repair.
No FFmpeg buffering flags or frontend playback timers were changed in this sprint.

### Baseline repeated real Chrome tone test

Added `scripts/test-audio-cold.mjs`. Each round creates a fresh private PulseAudio
daemon with cookie authentication, fresh native manager and fresh real Chrome
profile. It navigates only its test browser to an ephemeral local page, uses an
X11 key gesture to start a 440 Hz WebAudio oscillator, confirms the Chrome page's
playback signal and matching Pulse sink input, then receives nonzero PCM through
the authenticated `/audio` WebSocket. No shared daemon is killed or anonymous
Pulse access enabled; see the official [PulseAudio protocol authentication reference](https://wiki.freedesktop.org/www/Software/PulseAudio/Documentation/User/Modules/#module-native-protocol-unixtcp).
Profiles/sinks are cleaned after each round; allowance
records are retained. This is a backend stream test, **not a connected noVNC viewer
or human-confirmed speaker test**. OS caches are not flushed: these are process-cold
starts, not cold host boots or hostile-load tests.

| Round / application | Pulse ready ms | Chrome ready ms | WS open ms | First PCM ms | Nonzero samples | Cleanup |
|---|---:|---:|---:|---:|---:|---|
| Baseline 1 | 133 | 4081 | 19 | 1237 | 5060 | PASS |
| Baseline 2 | 118 | 4052 | 14 | 1510 | 10168 | PASS |
| Baseline 3 | 121 | 4055 | 25 | 1570 | 1996 | PASS |
| Repaired 1 | 129 | 4073 | 24 | 1505 | 1996 | PASS |
| Repaired 2 | 121 | 4062 | 6 | 1496 | 1996 | PASS |
| Repaired 3 | 118 | 4070 | 13 | 1500 | 1996 | PASS |

Chrome-ready timing starts at HTTP creation; PCM timing starts at the authenticated
stream connection, after the tone is playing. Every round began with 1,500,000 ms
remaining allowance. The baseline already passed, so this table is not evidence
that the historical cold timeout was reproduced or eliminated.

### Verified defect and targeted fix

Injected an unreachable Pulse server in the owned test manager. At `cc14b1e`, the
old application returned **HTTP 201 and published a session with no per-session
audio sink**. The regression assertion correctly failed (201 versus expected 500).
The code had returned a null sink and allowed Chrome to start without PULSE_SINK,
which could also fall back to a default sink on a reachable server.

At `3bf239e`, the same real Linux fault returned **HTTP 500
SESSION_CREATE_FAILED**, published no session, removed the profile and recovered
the capacity reservation. Three fresh-process tone rounds then passed.

Changes:

- Require the audio server to answer, create the session-specific sink, immediately
  register its module with startup rollback, and verify the exact sink and monitor
  belong to that module before Chrome is launched. There is no null/default-sink
  fallback. Each pactl call is bounded to three seconds.
- Preserve the existing per-session FFmpeg monitor, stereo 44.1 kHz signed-16 PCM,
  WebSocket URL and backpressure policy. Add a **new ten-second first-PCM watchdog**,
  not a timeout increase: stalled initialization closes only that audio connection.
- Track captures until actual process close; disconnect/error/timeout sends TERM
  then KILL if needed. Session teardown includes these owned captures.
- Log sanitized capture-spawn/first-PCM/exit/error stages with elapsed time and
  session UUID, never bearer tokens, environment contents or arbitrary stderr.

Frontend callback/worklet buffering and startup shells were inspected and left
unchanged. Real audible playback, Safari worklet/autoplay behavior and recovery
after a running shared Pulse server dies remain unverified. The missing-server
defect is repaired; the original intermittent cold failure is **not proven repaired**.

## B. Isolation lifecycle slice and environment blocker

`deploy/isolation/offline-runtime.mjs` now executes the existing offline spec through
an explicitly enabled, host-qualified adapter. It checks for existing names before
creation, reserves UUIDs against duplicate launches, verifies exact inspected
IDs/labels before mutation, starts and inspects the container, rolls back partial
or ambiguous creations, stops/removes only owned IDs, verifies removal and retains
reservations when cleanup cannot be verified. Stop during startup is coordinated.

Podman commands are local-only argv calls, no shell, ten-second deadline, SIGKILL
on command timeout, 1 MiB output limit, and a minimal runtime environment without
GitHub tokens or remote-container variables. The existing offline networking and
CPU/memory/PID/tmpfs arguments are retained. The adapter returns `chromeReady:false`:
container-running is not Chrome/VNC/audio readiness.

Command semantics were checked against official [Podman stop](https://docs.podman.io/en/latest/markdown/podman-stop.1.html),
[exists](https://docs.podman.io/en/latest/markdown/podman-container-exists.1.html)
and [Node child-process](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback) documentation.

Its 17 new tests use a **simulated Podman runner** for lifecycle/fault cases. Two
also exercise real harmless Node subprocess timeout/output-limit behavior. These
are not real containers. The native manager does not import this adapter. No
production runtime selection, image, relay, egress proxy or durable recovery was
invented or enabled. Native development Chrome continues to run.

Direct Codespace checks: Podman absent; cgroup-v2 CPU/memory/PID controllers exposed,
subtree-control writable, nested user namespaces permitted. The service account
has 65,536 subordinate UIDs and GIDs, below the design's 327,680 for five workers.
Rootless Podman operation, actual quota enforcement
and Chrome sandbox compatibility inside a worker remain unqualified. No runtime
installation or security-policy weakening was performed. ISO-01–ISO-12 still need
the qualified target Linux host. See `isolation/OFFLINE-SPEC.md` for scope.

## C–D. Capacity, cleanup, authorization and regressions

The new capacity regression verifies that a failed fifth reservation releases only
its own slot while four existing reservations survive; a delayed duplicate cleanup
cannot free the replacement. This is a simulated reservation test, not five Chrome
sessions. Existing cap-five/sixth-denied/concurrent-launch/rollback tests still pass.
Production default remains one supervised tester; the existing setting can target
five only after host validation. Launch retry and allowance code remain unchanged.

Actual Linux smoke at `4d71102`:

| Check | Result |
|---|---|
| Owned Xvfb startup failure | HTTP 500 XVFB_FAILED; 2,781 ms; slot released |
| Chrome launch A / B | HTTP 201; 4,068 / 4,053 ms |
| Extra launch while active / retiring | HTTP 429 MAX_SESSIONS; slot released only after cleanup |
| VNC token probes | Invalid rejected; valid 12 bytes in 1,357 ms |
| Audio token probes | Invalid rejected; valid 8,756 bytes in 2,160 ms |
| Normal end and manager shutdown | Profiles gone; usage ledger and cookie secret retained |
| Final profile count | Zero |

Final read-only checks also found no Poxey Chrome/Xvfb/x11vnc/FFmpeg process or
3997/3999 listener. Only the idle default Pulse sink remained; the test-only daemon
was then stopped. The remote `rg` utility was absent, so the subordinate-ID read
was repeated successfully with grep; that was a diagnostic-tool limitation, not
an application test failure.

The smoke runs development authorization (valid/invalid bearer tokens), not live
production owner-cookie/Origin testing. Production policy tests still pass. No new
three/five-viewer benchmark was run: historical cold behavior remains unresolved,
production isolation/hosting are unqualified, and the limited Codespace budget was
used for bounded single-session diagnostics rather than a misleading capacity claim.
Five independent viewers with concurrent video/audible audio for 15–20 minutes,
sustained CPU/RAM/network/input latency/disconnect metrics, and a measured maximum
stable active-user count remain **NOT VERIFIED**.

### Final automated verification

| Group | Passing runner results |
|---|---:|
| Audio readiness/capture | 25 |
| Isolation prerequisites/specification/lifecycle | 49 |
| Capacity/teardown | 11 |
| Startup reliability | 11 |
| Security/deployment | 41 |
| Frontend | 26 |
| Worker (includes inherited JS/TS duplicate suites) | 77 |
| **Total** | **240** |

Final automated failures: **zero**. The intentionally failing pre-fix Linux fault
test above is retained as repair evidence, not hidden or excluded. Linux reruns
of audio (25), isolation (49) and capacity (11) passed and are not counted twice.
Both production builds, syntax/diff checks and production dependency audit passed
(zero production vulnerabilities). Earlier development-tool advisories are outside
this sprint's scope; do not expose Vite/Vitest as production services.

No observed deterministic regression. Deliberate behavior change: unavailable
per-session audio now rejects startup instead of publishing a silent/fallback
session. Interactive mobile touch/video and human-audible playback were not newly
validated. Frontend source/build artifact names, Chrome flags/sizes, authentication,
routes, proxy, timer and ledger format are unchanged. No lockfile edits.

## Preservation, files and checkpoints

Original lockfile hash before/after:
`8a115555d554d555d4aaa9e183a0e8891b3857c2abb174a4419678b020cd56ea`.
No original checkout changes, backups, ledger or signing secret were reset/deleted.
Only owned test profiles/sinks/processes and harness-created temporary cookie/socket
directories were removed. No main merge, force-push, public deployment, paid/cloud
activation, Cloudflare change or Mac public hosting occurred.

Exact changed files relative to `673ca98`:

1. `scripts/test-audio-cold.mjs` — repeated real Chrome-tone and missing-server tests.
2. `scripts/session-audio.mjs` — fail-closed sink readiness and immediate ownership.
3. `scripts/session-audio.test.mjs` — 15 readiness/rollback tests.
4. `scripts/audio-capture.mjs` — bounded capture lifecycle and sanitized stages.
5. `scripts/audio-capture.test.mjs` — 10 capture/recovery/process tests.
6. `scripts/poxey-session-manager.mjs` — integrate audio readiness/capture ownership.
7. `scripts/deployment.test.mjs` — audio wiring regression guard.
8. `scripts/session-capacity.test.mjs` — failed-fifth reservation regression.
9. `package.json` — focused test commands only, no dependency changes.
10. `deploy/isolation/offline-runtime.mjs` — guarded offline lifecycle adapter.
11. `deploy/isolation/offline-runtime.test.mjs` — 17 lifecycle/command-bound tests.
12. `deploy/isolation/OFFLINE-SPEC.md` — scope and environment evidence update.
13. `deploy/PHASE2-HANDOFF.md` — pointer to current report, historical evidence kept.
14. `deploy/PHASE3-HANDOFF.md` — this report and next-session instructions.

Pushed on `fix/phase2-reliability-isolation`:

- `32c919b`: baseline cold-process diagnostic.
- `cc14b1e`: missing-server regression reproduction.
- `3bf239e`: tested audio readiness/capture repair.
- `78b850e`: tested offline lifecycle adapter.
- `4d71102`: tested failed-fifth admission regression.
- Final checkpoint: commit containing this handoff and diagnostic-log collection
  update; retrieve exact ID with `git log -1`.

## E. Release gates and next three tasks

Existing `SERVER-ACCEPTANCE.md`, `README.md` and `isolation/IMPLEMENTATION.md` already
cover hardware measurement, Linux/cgroup/user-namespace requirements, Chrome
sandbox, audio/video dependencies and five-user acceptance. No duplicate deployment
guide was written and Student offers were not repeatedly checked/activated.

Next tasks:

1. Obtain approved eligible $0/no-card Linux hosting, qualify rootless Podman and
   subordinate IDs, then implement/test the worker image, private relays, restricted
   egress and durable recovery on that server. Keep it private; retain sandboxing.
2. Investigate the historical host-cold/loaded audio timeout using the new sanitized
   stage logs and real-tone test; verify audible playback/reconnect in Safari and
   production owner-cookie/Origin authorization. Do not call six process-cold
   successes proof of host-cold reliability.
3. Pass isolation/cleanup/full unchanged 25-minute tests, then run three and five
   independent real viewers with sustained video and human-confirmed audio on the
   intended host. Measure resources, enforce limits and obtain explicit launch approval.

Remaining public-launch blockers: actual per-session OS/network/X11/audio isolation,
production sandbox/authorization integration, historical cold-start uncertainty,
five sustained active viewers, eligible hosting, full timer/recovery validation and
reviewed admission/abuse policy (device-cookie reset can evade device identity).
**Public release remains forbidden / NO-GO.**
