# Phase 2 retest — October 13, 2026

Tested application commit: `85d8a6bc262d13311d6553618f5802b723959baf`, branch `fix/phase2-reliability-isolation`.

## Local verification on the Mac

Re-executed `test:reliability` (11), `test:isolation-plan` (11), `test:security` (39), frontend tests (26) and worker tests (77): **164 passing runner results, zero failed**. Both production builds passed. No application code changed during this retest.

## Actual Linux smoke test

Used the already-open Codespace through Safari. Created a separate detached worktree `/workspaces/poxey-phase2-smoke` at the tested commit, reusing installed dependencies. The original `/workspaces/attempt3` branch and files were left intact. Neither Poxey service nor PulseAudio was running at baseline. Started PulseAudio and a temporary manager in development mode; no frontend server or public port was enabled.

The 11 startup-resource tests also passed on Linux, including real owned-child termination and filesystem cleanup.

1. Issued one real session creation request and identified the test manager's own x11vnc child by its parent PID. Sent SIGTERM only to that child during startup. The manager returned HTTP 500 `VNC_NOT_READY` after **35,353 ms**, as expected for an injected readiness failure. It returned to zero sessions, zero profile directories and zero per-session PulseAudio sinks.
2. Restarted the temporary manager and asserted that no profile/sink leftovers remained. A fresh real Chrome session returned HTTP **201 in 4,206 ms**, with `remainingMs=1500000` (25 minutes).
3. For both `/websockify` and `/audio`, an invalid token was rejected and the valid session token received bytes. These were short stream probes, not full noVNC interaction or audible playback tests.
4. Ended only the test session: HTTP **200**. After the cleanup delay, health reported zero sessions, profile count was zero and no session sinks remained. Stopped the temporary manager.
5. Final process checks found no Xvfb, x11vnc or FFmpeg processes and no Chrome process using a Poxey temporary profile. Neither port 3997 nor 3999 was listening. PulseAudio remained idle with only its default `auto_null` sink; the separate test checkout was retained for future checks.

## Harness issues, distinguished from application results

- The first command stopped before launching the manager because it assumed `/tmp/poxey-sessions` already existed. Corrected the baseline check to accept a missing empty runtime directory. Its inline process-matching string encoding was also corrected before fault injection ran.
- The fault-injection harness initially asserted the narrower error `VNC_FAILED`; the actual race reached `VNC_NOT_READY`, so that assertion failed and the harness stopped before its recovery-launch phase. Its `finally` checks still showed complete resource cleanup. The separate subsequent recovery run asserted the absence of leftovers and passed Chrome launch, stream probes, end and cleanup. No application change was made to satisfy the harness.

## Preservation and limits

Original Codespace lockfile SHA-256 remained `8a115555d554d555d4aaa9e183a0e8891b3857c2abb174a4419678b020cd56ea`; its existing modification remains. No ledger was cleared, no existing backups overwritten, no main merge/public deployment performed, and no legitimate active user was interrupted.

This verifies one actual VNC-readiness startup rollback and a subsequent successful native development session. Other Linux startup-failure branches, production sandbox/authorization, container isolation, full 25-minute enforcement, three/five active viewers, video and human-confirmed audible audio remain unverified by this retest. The next-session plan remains `PHASE2-HANDOFF.md`, with this live evidence supplementing its earlier local-only results.
