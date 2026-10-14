# Private server acceptance and October 15 decision

No resources have been activated. No permanent $0/no-card always-on Chrome backend
is account-verified. Student-credit offers, if eligible, are finite funding, not
proof of permanently free capacity. Do not use this Mac or Codespaces as the public
server, supply a card, enable paid overages, or use Oracle Cloud.

## Host requirements to verify before spending any credit

| Requirement | Evidence required |
|---|---|
| Eligible funding | Account shows the specific no-card Linux VM offer, quota, expiration, budget/spending cap and permitted use; user approves activation |
| CPU and RAM | Record exact vCPU/model/RAM; determine worker quotas and aggregate broker/OS headroom from the actual 3- then 5-viewer test, not session-creation success |
| Architecture and storage | Linux x86-64 for current official Google Chrome path; disk fits immutable image(s), updates, bounded five-session ephemeral data, logs and retained release/ledger backups |
| Container boundary | Rootless Podman 5+, private namespaces, cgroup v2 with delegated CPU/memory/PID controllers, sufficient non-overlapping subordinate UID/GID ranges; host checker plus ISO acceptance tests |
| Chrome sandbox | Unprivileged nested namespaces and reviewed seccomp/LSM work inside the worker/service; `chrome://sandbox` confirms active sandbox, no `--no-sandbox` fallback |
| Display/audio | Each worker owns Xvfb, x11vnc, PulseAudio, sink and FFmpeg; no shared host X11/audio mounts; current sizes and playback remain unchanged |
| Network | Restricted egress proxy blocks host/private/metadata/peer access, including IPv6 and DNS rebinding; public HTTPS/video still work; no published worker/backend ports |
| Transport | Approved domain, trusted HTTPS/WSS Caddy routing, private manager 3997; no Vite, 3999, VNC/Pulse/debugging ports exposed |
| Durable state | One broker writer, persistent private ledger and cookie secret; backup/recovery tested; deleting a session never removes usage records |
| Operations | Patch policy, restart/health checks, token-redacted logs, disk/RAM/OOM/egress alerts, verified shutdown cleanup and rollback release |

The observed development machine is a test reference, not a minimum-host promise.
No fixed CPU/RAM/bandwidth number is certified for five active users. The offline
worker specification's sample quotas are parser examples, not Chrome sizing advice.
Measure sustained bandwidth and the offer's egress allowance before approving beta.

## Phase 4.2: concrete candidate comparison (not benchmarks)

**A verified minimum for five active users is still unknown.** For comparing
eligible $0/no-card offers, an initial *evaluation* tier is 4 vCPU / 8 GiB RAM /
30 GiB disk; a roomier evaluation tier is 8 vCPU / 16 GiB / 40 GiB. These are
planning reservations, not measured requirements, capacity guarantees or advice
to purchase anything. A smaller eligible host may only qualify for fewer users;
do not waive the five-user test or create paid resources to match these numbers.

Derive memory from measured worker peaks plus broker/OS/runtime reserve, not
Chrome process count. Illustrative quota budgets: 5 × 1 GiB + 2 GiB reserve =
7 GiB; 5 × 2 GiB + 2 GiB = 12 GiB. Neither worker quota is proven sufficient for
YouTube/multiple tabs. Tmpfs/shared-memory usage is charged within memory limits,
not free extra RAM. Inspect effective cgroup `memory.max` and `cpu.max`; displayed
VM hardware can exceed the actual container quota. Do not rely on swap for steady
interactive capacity or assert that the example 0.5-core worker quota is adequate.

Use a currently supported/patched 64-bit Linux distribution (for example a
supported Ubuntu/Debian release) with actual Podman **5+** packages and delegated
cgroup v2. Do not assume the distribution's default Podman meets this project's
policy. The current fixture and worker qualification target Linux x86-64;
ARM compatibility has not been tested by this project, regardless of upstream
Chrome platform availability. [Chrome's supported Linux prerequisites](https://support.google.com/chrome/a/answer/7100626?hl=en).

For five `auto:size=65536` workers, reserve at least **327,680 subordinate UIDs and
327,680 subordinate GIDs**, non-overlapping across allocations/accounts, with
appropriate `newuidmap`/`newgidmap`, OCI runtime, systemd delegation and nested
sandbox support. Confirm usable blocks rather than merely summing duplicate or
fragmented entries; the current prerequisite checker does not certify overlap
against other accounts. Do not mix unbounded keep-id/nomap allocations with this
pool. Actual namespace mappings, LSM/seccomp and cgroups must pass ISO tests.
[Podman user-namespace allocation semantics](https://docs.podman.io/en/latest/markdown/podman-run.1.html#userns-mode).

Disk must fit shared immutable worker image layers, a retained rollback release,
package/update overhead, bounded logs, durable lifecycle metadata and protected
accounting backups. The image is not yet built, so its actual size is unknown;
measure with `podman system df --format json`, `df -h` and workload measurements
before deciding a minimum. Never prune unknown resources/backups to gain space.
[Podman's read-only disk report](https://docs.podman.io/en/latest/markdown/podman-system-df.1.html).

Networking requires long-lived authenticated HTTPS/WSS, approved outbound public
web/DNS/media through restricted egress, and enough measured throughput/transfer
allowance. Backend/VNC/Pulse/debug ports stay private; no inbound UDP is currently
required by the existing WS streaming architecture. Review any later browser
WebRTC/UDP requirements without weakening metadata/peer isolation.

One known format-based budget: 44,100 samples/s × 2 channels × 2 bytes/sample =
**176,400 bytes/s per continuously connected PCM audio stream**. Five streams are
882,000 bytes/s = **7.056 Mbps**, or **1.0584 GB for 20 minutes**, before WS/TLS,
video and retransmission overhead. This is arithmetic from the current capture
format, not observed server egress. Measure noVNC video and real client throughput
separately; free egress limits may be a bigger constraint than image storage.

The worker image needs official real Chrome, fonts/CA certificates, Xvfb, x11vnc,
PulseAudio/pactl, FFmpeg and xdotool. The broker needs the reviewed Node/runtime
dependencies and private persistent state; the proxy needs static frontend
artifacts, trusted HTTPS/WSS and unchanged routes. The per-worker image/entrypoint,
private relays, restricted egress and crash journal still require implementation.

Use `LOAD-TEST.md`'s dedicated-host protocol diagnostic first, then ISO-01–ISO-12
and three/five independent real noVNC clients. Record exact commit/image/tool
versions, host and effective quotas, startup/steady/peak CPU/RAM/PIDs, OOM events,
interface and actual client bytes, input latency, disconnects, audible/video stalls
and cleanup. The raw-RFB synthetic harness is not the real-site/public capacity
benchmark. Review `ALLOWANCE-THREAT-MODEL.md` before claiming per-person limits.

No Student benefit was checked or activated during Phase 4.2. Eligibility, $0
funding, no card, runtime privileges, transfer budget, sleeping/expiry rules,
permitted hosting use and spending protection all remain account-level checks
before approving any server. No qualifying permanent free host is established.

## Deployment sequence, after host eligibility and explicit approval

1. Follow `README.md`'s separate builder/release-directory instructions. Preserve
   the original checkout and lockfile, use the reviewed engineering commit, run
   `npm ci`, focused tests and builds. Install only backend production dependencies
   in the service release; do not run a development server publicly.
2. Complete the worker image, broker runtime adapter, restricted egress and crash
   reconciliation in `isolation/IMPLEMENTATION.md`. `OFFLINE-SPEC.md` is deliberately
   not a deployable replacement. Review the existing systemd unit for the container
   service's actual delegation/storage/network needs before using it.
3. Keep Caddy bound to loopback and the firewall private. Preserve existing ledger
   and signing secret. Start with `POXEY_MAX_SESSIONS=1`, verify health, namespaces,
   authenticated routes, static noVNC/audio assets and real sandboxed Chrome.
4. Pass ISO-01 through ISO-11, including cross-user cookie/token attempts, private
   resources, metadata positive controls, faults, restart and full unchanged
   25-minute expiration. Do not shorten the timer or reset allowance to pass a test.
5. Set `POXEY_MAX_SESSIONS=5` only for a supervised test. Connect three then five
   independent authenticated noVNC clients; type, scroll, open tabs and play
   permitted video with human-confirmed audio for 15–20 minutes. Record CPU/RAM,
   cgroup limits/OOM/PIDs, network throughput, input responsiveness, stalls,
   disconnects and cleanup. Verify a sixth is denied and the first five remain usable.
6. If all gates pass, request approval to expose the approved HTTPS frontend and
   launch. Otherwise keep it private and postpone. Optional Cloudflare Pages serves
   static frontend files only; it does not supply Chrome compute. No Cloudflare
   configuration was changed in this sprint.

## Release decision

**No-go** if eligible compute, container isolation, production sandbox, owner-bound
WSS/HTTP, persistent allowance, cleanup, or five sustained real viewers is missing.
An October 16 deadline does not waive these gates. Recheck account benefits on
October 15 once, not repeatedly during this engineering sprint. Existing conditional
hosting references are in `README.md`; availability/eligibility must be verified in
the actual account before activation.
