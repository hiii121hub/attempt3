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
