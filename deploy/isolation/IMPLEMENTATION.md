# Phase 2: per-session isolation implementation and acceptance specification

Status, October 13, 2026: **designed; runtime adapter and container image not implemented or verified**. The available machine is macOS without Podman/Docker or a qualified Linux deployment server. The host prerequisite checker and its tests are implemented. Do not enable public multi-user access based on this document or the checker passing.

## Selected boundary

Use one rootless Podman OCI container for **each** session's complete Chrome + Xvfb + x11vnc + PulseAudio stack. Keep the trusted Node session broker, token authorization, device cookies, 25-minute/24-hour ledger and Caddy outside those containers. Preserve the existing frontend and `/websockify`/`/audio` URLs.

Per-session Linux users alone do not isolate host networking. One shared container around all sessions still exposes shared display/audio sockets. A per-session supported OCI runtime supplies the filesystem, process, IPC, user and network boundary; it must still be tested with Chrome's own sandbox enabled. Containers share a kernel, so use a dedicated patched host without unrelated workloads and retain a VM-based option if the threat model requires a stronger kernel boundary. [Podman's supported run options](https://docs.podman.io/en/latest/markdown/podman-run.1.html).

## Exact prerequisites before implementing the adapter

Run as the dedicated unprivileged container-owning service account:

```sh
npm run check:isolation-host
podman info --format json
unshare --user --map-root-user true
```

The checker requires Linux, non-root execution, Podman major version 5+, rootless mode, cgroup v2 with delegated cpu/memory/pids controllers, nested user namespaces, and at least 327,680 subordinate UIDs and GIDs for five non-overlapping `--userns=auto:size=65536` allocations. An administrator must configure appropriate **non-overlapping** `/etc/subuid` and `/etc/subgid` entries, delegation and distribution security policy. The numerical count check does not inspect overlap with other accounts; the administrator must verify it. Do not weaken AppArmor/SELinux globally or run privileged containers when a check fails.

Also required: a native Linux x86-64 VM able to install official Google Chrome; updated kernel/OCI runtime/seccomp and LSM policy; a persistent broker-only state directory; working DNS/TLS; enough disk/tmpfs and memory for measured session workloads. The cgroup numbers below are required configuration inputs, not five-user sizing claims. Confirm rootless network isolation and proxy behavior on the exact Podman/Netavark versions installed.

No eligible hosting account, machine quota or hardware size is assumed. Check the Student benefit and no-card VM eligibility on October 15 before creating resources. The hosting rules and conditional Azure option remain in `../README.md`; no paid resources were activated.

## Runtime contract to implement on that host

1. Add a small broker adapter with `start`, `vncStream`, `audioStream`, `resize`, `stop`, and `recover` operations. Keep the current native development adapter. Select the container adapter explicitly for production only after acceptance succeeds. Keep the existing startup lock, bounded frontend retry, authorization and allowance accounting in the broker.
2. `start` receives a broker-generated session UUID, display settings, and operator-validated CPU/memory/PID/tmpfs limits. It starts an immutable image pinned by digest using argv arrays, `--pull=never`, a non-root container user, `--userns=auto:size=65536`, private PID/IPC/cgroup namespaces, dropped capabilities, no-new-privileges, read-only image filesystem and private ephemeral writable mounts. Retain reviewed seccomp/LSM profiles; never add SYS_ADMIN or use `seccomp=unconfined` just to make Chrome start. Explicitly bound `/dev/shm`, `/tmp`, the profile filesystem, memory/swap, CPU and PIDs. Do not mount broker state, home, repository, host X11/Pulse sockets, devices, or a runtime socket into a worker.
3. The worker starts its own PulseAudio daemon, one session sink, Xvfb with the current 1600x1200 framebuffer and the existing Chrome dimensions, Chrome with its sandbox enabled, and loopback-only x11vnc. It supplies only minimal worker environment variables. No user bearer token, cookie-signing secret or cloud credentials enter the worker. Its readiness response must prove Chrome, the display, VNC and PulseAudio are ready, with bounded startup timeout. A process merely existing is insufficient.
4. Keep VNC private without publishing container ports: the trusted broker spawns a narrowly scoped `podman exec` relay to that worker's loopback VNC, forwarding existing authenticated WebSocket bytes over managed stdio. Run the existing FFmpeg capture inside the selected worker and forward PCM through the existing audio WebSocket. `resize` runs the existing xdotool operation inside that worker. Container IDs and commands come only from the broker's session map; browser requests cannot supply arbitrary runtime arguments or executable paths. Preserve audio buffering and reconnect semantics. Runtime administration remains available only to the trusted broker, never to Chrome.
5. Every worker gets its **own internal network**, with no default direct internet/host route. Permit only a dedicated, restricted web-egress proxy attached to that internal network and a separate outbound network. The proxy must disable IP forwarding, deny private/reserved/link-local/metadata destinations for IPv4 and IPv6, validate every DNS result and redirect destination, and prevent DNS rebinding by connecting to the validated destination. Use a supported proxy with reviewed ACLs, not a custom application fetch proxy. Configure production Chrome to use it, then regression-test navigation, HTTPS CONNECT, video and other required protocols. Container-local loopback must still work for its own VNC/audio; host loopback and peer networks must not be reachable. Podman network isolation alone is not a complete metadata/egress policy. [Internal network behavior](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
6. `stop` performs a bounded graceful stop followed by forced termination of **that container**, removes its ephemeral mounts/network, and verifies disappearance. Keep the broker ledger and cookie secret. Startup rollback must stop any partial worker/network even when image startup or readiness fails. Use labels containing only broker-issued IDs to recover owned orphan resources on restart; never prune all containers/networks or affect unrelated workloads. Do not automatically restart expired sessions or reuse profiles.
7. On broker restart, invalidate old stream access, charge usage conservatively through the recorded stop/expiry boundary, clean only owned ephemeral resources, and preserve the ledger. Store enough lifecycle metadata durably to reconcile a crash. Do not run five independent uncoordinated ledgers or share one JSON ledger across multiple writer processes. Implement atomic single-writer recovery before enabling multiple broker replicas.

The existing production systemd unit is a single native-stack candidate. It is **not** a tested rootless Podman service unit: PrivateTmp and service/cgroup delegation require review when wiring in the adapter. Do not copy it unchanged and claim container orchestration works. Review supported systemd/Quadlet supervision and delegation on the host. [Podman systemd integration](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).

## Acceptance tests to execute on Linux

Use only temporary test identities and synthetic canaries. Keep the service private. Record tool versions, exact commit, image digest, host specs, commands and outputs. A failed or unexecuted row blocks release.

| ID | Actual test | Required result |
|---|---|---|
| ISO-01 | Start A and B; inspect `/proc/self/ns/{user,mnt,pid,ipc,net}` from inside each worker and compare host/A/B | All required namespaces differ; workers are non-root and have non-overlapping host UID mappings |
| ISO-02 | Create distinct canary files at the same profile path in A/B; attempt cross-profile, broker-state, host-home and runtime-socket access from each worker | Only own canary readable; no host/broker mounts; image root is read-only |
| ISO-03 | Start labeled test sentinel processes in A/B; enumerate processes and attempt to signal the other sentinel | Other worker/host process invisible and unsignalable |
| ISO-04 | Enumerate/open X11 sockets and PulseAudio monitors in each worker | Only its own display/server/sink accessible; cross-session X11/Pulse connection fails |
| ISO-05 | Put a known-live canary listener on host and on the peer worker; attempt TCP connections from A/B, including gateway aliases and IPv6; test metadata addresses with connection-only probes that request no credentials | Host/peer/metadata unreachable while permitted public HTTPS succeeds; blocked targets must have positive controls so an offline target is not mistaken for isolation |
| ISO-06 | Exercise proxy ACLs with a test DNS name changing public to private addresses, private redirect targets, literal/encoded addresses, CONNECT and IPv6 | No private/metadata connection; normal required browser navigation and media still work |
| ISO-07 | Inspect actual worker cgroup `memory.max`, `memory.swap.max`, `pids.max`, `cpu.max`; run bounded synthetic quota tests on an otherwise idle test host | Configured limits enforced; one worker cannot exhaust broker/host; stop before aggregate pressure |
| ISO-08 | Open `chrome://sandbox` in each real Chrome session and inspect runtime security settings | Chrome sandbox active, no insecure fallback or added broad capabilities |
| ISO-09 | Authenticate A/B normally; try A's token with B's cookie, wrong/missing Origin, invalid and expired tokens on HTTP/VNC/audio; reconnect Safari A | Cross-user requests rejected; owning user reconnects; no tokens in logs |
| ISO-10 | Inject failure after every start step, lose relay, crash worker and restart broker | Failed workers, sinks, profiles, relays and networks removed; other session survives; ledger retained; next launch succeeds |
| ISO-11 | Run one real session to its unchanged 25-minute limit; refresh and restart broker, then attempt relaunch | Allowance does not reset; expired session resources and stream access are gone |
| ISO-12 | Three then five independent connected noVNC viewers with typing, scrolling, tabs, permitted video and human-confirmed audio for 15–20 minutes | Record CPU/RAM/PIDs/OOM/bandwidth/latency/update rate/audio stalls/cleanup; accept a cap only from actual stability results |

The local prerequisite-unit tests do not execute ISO-01 through ISO-12. Their purpose is to prevent attempting the prototype on an unsuitable host. Those acceptance tests and the container adapter remain **UNVERIFIED / NOT IMPLEMENTED** until a qualified server is available.
