# Disposable five-session protocol load test

Phase 4.2: **implemented and unit tested; real Linux Chrome execution NOT VERIFIED**.
This is a backend protocol/fixture diagnostic, not five people, the noVNC frontend,
audible playback acceptance, a production isolation proof, or a release benchmark.

## Safety contract

Never run on the original Codespace, a production installation, or a machine with
real-user accounting. There is no external target URL, existing-service attachment
or force switch. The executable refuses macOS/root, original checkout/recovery
locations, `/etc/poxey`, `/var/lib/poxey`, configured accounting, existing runtime
state, browser/media/proxy processes, HTTP/HTTPS proxy listeners, or busy backend
ports. Uncertain inspection refuses. The original Codespace deliberately fails
these checks regardless of its allowance deadline. No service is started by tests.

On a separate **dedicated disposable Linux x86-64 test host** only, the command
creates a new private output subdirectory, synthetic accounting fixture, private
authenticated Pulse daemon and its **own** loopback-only manager process. It
checks Linux socket inode ownership and PID start time before requests, preventing
an unrelated service winning a bind race from becoming the test target. It never
changes the production session default or starts Vite/Caddy/a public website.

The fixture bootstraps an empty synthetic ledger with the same synthetic clock
pattern as the accounting unit tests. Its test-only credentials are not recovered
or replacement real-user keys. It cannot import a ledger or select existing state;
the destination is always freshly created outside Git and temporary storage.
The Phase 4.1 recovery code, real manifest, deadline and records remain untouched.
Never repurpose a fixture directory as live accounting or a recovery procedure.

The current executable starts the **native** broker with production authorization
and sandbox policy, cap five, and HTTPS-origin forwarding headers over local HTTP.
It does not implement container orchestration, Caddy TLS, or internet-egress policy.
After the real production adapter exists, a separately reviewed fixture setup is
needed to exercise it; do not present this native run as container qualification.

## Future invocation — not executed during Phase 4.2

Use an empty private fixture root owned by the dedicated test account, outside the
repository. Install the existing Linux dependencies, production-capable real
Chrome at `/usr/bin/google-chrome`, working nested sandbox namespaces and cgroup
v2 CPU/memory/PID telemetry. Do not disable Chrome's sandbox. The CLI requires at
least 2 GiB initial *available headroom* as a safety guard, **not** a five-user RAM
recommendation. See `SERVER-ACCEPTANCE.md` for evaluation sizing.

```sh
# In a separate engineering clone on the disposable host, after host review:
npm run test:load-harness
npm run load:disposable-host -- --disposable-host /srv/poxey-load-fixtures 900
# 1200 seconds is the maximum; shorter durations are diagnostics, not acceptance.
```

The output root must already exist, canonical/no-symlink, account-owned and mode
0700. No host setup, package installation or cloud activation is performed by the
command. Never run it with sudo. The created subdirectory retains a 0600 sanitized
`load-report.json` and private synthetic state for reviewed debugging; it is not
uploaded/committed. Backups and unknown resources are never pruned. A future
operator may remove only an explicitly validated disposable test directory after
review, not user state or workspace roots.

## What the driver does

1. Creates six independent signed synthetic browser identities. Launches five
   requests concurrently, retries only `SESSION_CREATION_BUSY`, bounded to two
   minutes, and rejects duplicate session IDs/tokens. A sixth must receive HTTP
   429 `MAX_SESSIONS`; any accidentally created sixth is included in owned cleanup.
2. Probes both existing WS paths with a wrong owner's cookie and invalid token.
   An opened unauthorized socket fails. Connection refusal/HTTP 500 does not pass
   as successful authorization rejection. A broker reset is accepted only with
   the independently owned listening manager still present; valid controls follow.
3. Negotiates RFB 3.8 and raw framebuffer updates through `/websockify`, sends
   keyboard navigation to its **own local synthetic media page only**, and checks
   Chrome's HTTP acknowledgement of input. The page plays generated canvas video
   and a different pure tone per session after a real RFB key gesture.
4. Opens authenticated stereo PCM through `/audio`, checks the expected tone and
   absence of other test tones, and checks unique screen-color canaries. This can
   catch specific misrouting/mixing; it does **not** prove arbitrary filesystem,
   process, metadata-network or hostile-user isolation. ISO-01–ISO-11 remain needed.
5. Requires sufficient remaining *unchanged* allowance for the sustained interval
   plus cleanup headroom. Heartbeats, raw-frame/audio continuity and input
   acknowledgements are checked throughout. No reconnect or allowance reset occurs.
6. Records launch times, heartbeat maximum latency, input-ack maximum latency,
   RFB frames/bytes, PCM bytes/tone windows, host and cgroup-normalized CPU,
   effective memory/available headroom, PID count, OOM-kill deltas, and per-interface
   byte counters/rates. Launch/setup bytes are separated from sustained bytes.
7. Stops on OOM, less than 512 MiB available memory, over 85% effective memory use,
   three consecutive CPU samples over 90%, lost streams or failed assertions.
   These are conservative test stop policies, not certified service thresholds.
8. Ends only its own sessions, verifies zero sessions/slots/profiles/sinks and intact
   synthetic accounting, then TERM/KILLs only its own process groups and verifies
   disappearance. Unknown leftovers produce FAIL and require review, never prune.

## Interpretation and remaining validation

- The RFB probe uses raw pixels with at most five outstanding-request opportunities
  per second and no resize commands. noVNC uses different browser decoding and
  encodings; these results cannot establish its production bandwidth/performance.
- All five protocol clients and samplers currently run on the server, so their CPU
  and loopback traffic are included. Interface rates must not be summed blindly:
  bridge/loopback traffic can be counted more than once and is not billed egress.
- The generated video/tone is reproducible, not YouTube, ChatGPT, multiple real
  tabs, mobile gestures or audible client output. Reports explicitly mark human
  acceptance, arbitrary file isolation and real-site workload NOT VERIFIED.
- Current unit tests inject transport, time, host and Podman fixtures. Their
  simulated sustained interval is not a real 15–20-minute run. Actual native CLI
  startup/cleanup, RFB compatibility, Pulse capture, metrics and quotas need Linux
  integration; exact Podman fields need a qualified runtime/image.
- A PASS from this diagnostic is necessary preparatory evidence only. Public
  capacity still requires five independent noVNC browsers/people, real permitted
  websites/video, human-confirmed independent audio, input/touch, real HTTPS/WSS,
  cleanup and 15–20-minute resource/latency stability on the intended server.
