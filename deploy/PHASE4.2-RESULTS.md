# Phase 4.2 production-readiness preparation — October 14, 2026

**Two tested preparatory milestones completed. Public release and 80% development
acceptance are NOT claimed. Identity recovery remains separate and blocked.**

## Baseline and preservation

Mac engineering checkout began clean at
`a9f5ba197a31123ccc2323a86e7be9517ce77f0e`, on
`fix/phase2-reliability-isolation`; fetch confirmed the same remote HEAD. Branches,
worktrees and remotes were inspected; no reset/clean/force-push/main merge occurred.
One existing local engineering worktree was reused, without touching other branches.

Safari showed all 11 Codespace forwarded ports Private with no running processes.
The Codespace then auto-stopped due to inactivity before terminal preservation
checks could execute. It was **not restarted** and no remote command ran. No fresh
original HEAD/lockfile/state checksum verification or synchronization is claimed.
Last personally verified original HEAD remains Phase 4.1's `a9f5ba1`, with the
existing modified lockfile; its historical hash and backups are in that report.

No live Poxey manager/frontend/Chrome/Pulse/container was started. The actual load
CLI's Mac refusal path was tested: BLOCKED before directory/key/service creation.
Real-user usage records, original lockfile, backups and
`/workspaces/.poxey-state/attempt3` were never written, mounted, deleted or migrated.
No real replacement signing key was activated, and no recovery manifest/deadline
was changed. The unchanged accounting tests still use disposable synthetic keys.

## Milestone 1 — safer offline isolation lifecycle

`c71c72c` adds a unique attempt UUID to worker labels, independently of session
UUID/name. Cleanup/ambiguous-create rollback requires the exact attempt as well
as the inspected ID, name and owner. Prototype labels are now v2; old v1 resources
are not automatically claimed or removed.

Before **and** after container start, strict inspection validates pinned image,
non-root user, private namespaces, no privileges/capabilities, read-only root,
no host bind/device/published-port access, CPU/memory/swap/PID/shared-memory/tmpfs
configuration and worker-private audio environment. Unknown/missing unsupported
fields fail closed. Failed-policy rollback still removes only correctly owned
resources; uncertain ownership/cleanup retains the reservation.

Image environment inheritance, persistent container logs and automatic restart
are disabled. The original native manager never imports/selects this adapter.
The checks use synthetic Podman inspection fixtures, not real runtime output.
Actual kernel enforcement, Chrome sandbox compatibility and user separation are
**NOT VERIFIED**. Worker image/entrypoint, relays, web egress, durable lifecycle
journal/restart reconciliation and production wiring remain unfinished.

## Milestone 2 — disposable five-session test tool

`1fcb452` implements the bounded protocol driver and dedicated-host native fixture;
`3c58fc2` completes the proxy-preflight success path/shutdown verification. The
containing checkpoint adds network byte-rate and sustained-byte reporting and
the operations/hosting/threat-model handoff.

The CLI cannot attach to an existing URL/service. It refuses the original
Codespace/recovery locations, existing configured state, production config/state,
browser/audio/proxy processes, busy ports and uncertain host checks. On an empty,
explicitly acknowledged disposable Linux host **only**, it would own its fresh
synthetic state, private Pulse daemon, local media page and cap-five manager.
The fixture's test-only synthetic clock/bootstrap is not a live recovery/import
path; this sprint did not execute it on Linux or activate real credentials.

The driver implements concurrent launches with bounded busy-only retry, unique
identity/token checks, sixth rejection, cross-owner/invalid-token WS probes, RFB
frame/input exchanges, per-session screen/tone canaries, authenticated PCM,
heartbeat stability, CPU/memory/PID/OOM/interface rates, allowance headroom and
owned cleanup verification. It stops on resource pressure, stalls and cancellation.
Duration defaults to 900 seconds, maximum 1200. See `LOAD-TEST.md` before any use.

Its video is a reproducible local canvas stream, audio is sine tones, and the
client is raw RFB rather than noVNC. It currently exercises the native broker's
production policy, **not container runtime integration**. Same-host client costs
and loopback traffic differ from real clients. File/process/network isolation,
YouTube/ChatGPT workloads, audible output, HTTPS proxy and five human/noVNC users
remain NOT VERIFIED. No real performance numbers were generated this sprint.

## Verification actually completed

| Focused suite on Mac | Passed | Failed / skipped |
|---|---:|---:|
| Isolation prerequisite/spec/lifecycle/inspection | 82 | 0 / 0 |
| Load harness guards/protocol/metrics/failure orchestration | 39 | 0 / 0 |
| Accounting and startup refusal | 36 | 0 / 0 |
| Security/deployment | 43 | 0 / 0 |
| Capacity/teardown | 11 | 0 / 0 |
| Startup reliability | 11 | 0 / 0 |
| Audio readiness/capture | 25 | 0 / 0 |
| Frontend launch/heartbeat/pagehide | 28 | 0 / 0 |
| **Total focused tests** | **275** | **0 / 0** |

This includes 33 additional isolation tests and 39 new harness tests (72 new
focused cases). Simulated five-client/time/Podman fixtures are not live results.
The first harness run had one overly strict floating-point equality assertion
(19.999999999999996 versus 20); it was corrected to a tight numeric tolerance.
Review also caught a missing successful return in the empty-host proxy probe;
it was fixed and its real event path regression-tested before final validation.
No test was hidden/excluded to obtain passing results.

Both frontend and worker production builds passed. Frontend artifacts still match
Phase 4.1 (`index-DLy7q3rK.css`, `index-C4Sp4kB9.js`). Syntax/whitespace checks pass.
The read-only Mac isolation-host check returned the **expected not-ready exit 2**:
no native Linux/rootless Podman/cgroup/subordinate-ID environment. This is a host
blocker, not a passed isolation acceptance test.

Linux reruns, actual Podman containers, enforced quotas, full fixture startup,
real RFB/PCM interoperability, sustained load and cleanup are BLOCKED/unexecuted.
Historical Codespace blockers were absent Podman and 65,536 subordinate UIDs/GIDs
versus the design's 327,680; those were not rechecked after auto-stop. Worker tests,
dependency audits and manual Mac/Chromebook acceptance were not rerun. No runtime
behavior regression was observed in focused tests; unchanged source is not a
substitute for the blocked live checks.

## Allowance and hosting conclusions

`ALLOWANCE-THREAT-MODEL.md` documents cookie clearing/new-browser/private-profile
bypasses. Signature integrity and persistent accounting do not prove person
uniqueness. No new auth provider, invasive fingerprint, IP-based identity,
invitation system or recovery/accounting change was introduced. A reviewed beta
admission/abuse policy is still required.

`SERVER-ACCEPTANCE.md` now has candidate sizing tiers and a resource budget formula,
actual runtime/UID/GID/architecture/network/storage requirements and measurement
gates. There is **no measured five-user minimum**. 4 vCPU/8 GiB/30 GiB is an
unverified evaluation tier; 8 vCPU/16 GiB/40 GiB a roomier tier, not a purchasing or
capacity guarantee. Current PCM format mathematically implies 7.056 Mbps for five
continuous audio streams, before video/WS/TLS, not a benchmark.

No Student account/offer was checked or activated, no host was procured, and no
permanent $0/no-card hosting solution is established. No DNS, Cloudflare, public
network, spending or card changes occurred.

## Exact files changed relative to a9f5ba1

1. `deploy/isolation/worker-spec.mjs`
2. `deploy/isolation/worker-spec.test.mjs`
3. `deploy/isolation/offline-runtime.mjs`
4. `deploy/isolation/offline-runtime.test.mjs`
5. `deploy/isolation/worker-inspection.mjs` (new)
6. `deploy/isolation/worker-inspection.test.mjs` (new)
7. `deploy/isolation/worker-fixture.mjs` (new, synthetic test JSON only)
8. `deploy/isolation/OFFLINE-SPEC.md`
9. `scripts/load-test/guard.mjs` (new)
10. `scripts/load-test/guard.test.mjs` (new)
11. `scripts/load-test/rfb.mjs` (new)
12. `scripts/load-test/rfb.test.mjs` (new)
13. `scripts/load-test/metrics.mjs` (new)
14. `scripts/load-test/runner.mjs` (new)
15. `scripts/load-test/runner.test.mjs` (new)
16. `scripts/load-test/cli.mjs` (new)
17. `package.json` (test/tool commands only; no dependencies/lockfile edits)
18. `deploy/LOAD-TEST.md` (new)
19. `deploy/ALLOWANCE-THREAT-MODEL.md` (new)
20. `deploy/SERVER-ACCEPTANCE.md`
21. `deploy/PHASE4.2-RESULTS.md` (new)

Frontend/CSS/touch, worker, real Chrome flags/dimensions, native audio/VNC/session
manager, proxies, timer, startup scripts and all Phase 4.1 recovery code are
unchanged. The default production cap remains one, not an unverified five.

## Resume safely

All changes belong on `fix/phase2-reliability-isolation`. Read the containing final
commit with `git rev-parse HEAD`; the final response records its pushed hash.
No original Codespace sync was attempted after it stopped. When it is separately
reopened, inspect its current status/branch/lockfile before a non-destructive sync:

```sh
cd /workspaces/attempt3
git status --short --branch
git branch --show-current
sha256sum package-lock.json
# Continue only on fix/phase2-reliability-isolation with reviewed local changes:
git fetch origin
git merge --ff-only origin/fix/phase2-reliability-isolation
git status --short --branch
sha256sum package-lock.json
```

Git must abort rather than overwrite overlapping local changes; do not stash,
reset, restore or force checkout to get around a refusal. No command above edits
recovery state or starts Poxey. Do not run `npm run dev`, the live harness, or key
activation while recovery remains blocked. The stopped/restarted Codespace may
require reviewing the Phase 4.1 boot proof before any later activation.

Next priorities: (1) safely resolve recovery and verify newest real-client behavior
when permitted; (2) obtain an eligible qualified Linux host and finish image/relay/
egress/journal integration with ISO security tests; (3) qualify the new diagnostic,
then run five real noVNC clients/people with real sites and audible audio for
15–20 minutes. Hosting, true isolation, allowance-abuse policy, Chromebook retest
and production acceptance remain public-beta blockers.
