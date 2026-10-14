# Offline worker-spec milestone — October 13, 2026

Status: **preparatory implementation, unit tested; not a production runtime**.
`worker-spec.mjs` produces validated argv arrays; it never executes Podman, changes
the native development stack, starts Chrome, or serves users. The image, runtime
adapter, relay and restricted internet-egress proxy in `IMPLEMENTATION.md` remain
unimplemented. Do not enable public access based on these unit tests.

Phase 3 adds `offline-runtime.mjs`: an explicitly enabled, host-qualified offline
create/inspect/start/stop/remove adapter using this specification. It rejects
duplicate IDs and existing names, reconciles ambiguous creation failures by owned
labels, verifies removal and retains failed-cleanup reservations. Its local Podman
commands have a 10-second execution deadline, 1 MiB output cap and no shell or
remote-mode/credential environment inheritance. Stop uses Podman's bounded
TERM/KILL behavior. Tests exercise the lifecycle with a **simulated Podman runner**,
plus real harmless Node subprocess timeout/output-limit tests. No actual container
boundary is proven by those tests.

The adapter is not imported by the native session manager. `chromeReady:false`
is intentional: a running offline container is not proof that Chrome, VNC or audio
is ready. The worker image, relays, restricted web egress and durable restart
reconciliation still need implementation and Linux integration. No default
runtime or production flag enables this adapter automatically.

## Implemented contract

- Broker-issued v4 UUID and digest-pinned image required; unknown arguments,
  host mounts, arbitrary environment, published ports and privileged mode rejected.
- Private user/PID/IPC/cgroup namespaces, non-root worker, dropped capabilities,
  no-new-privileges, read-only image and ignored image-declared volumes.
- Offline network (`none`), no inherited HTTP proxy and no host aliases. This
  blocks ordinary internet browsing too: it is not the eventual web-egress design.
- Explicit CPU, memory, process and temporary/shared-memory limits. `/tmp`, `/run`,
  `/var/tmp` are ephemeral and bounded; HOME and PulseAudio use worker-private paths.
  The future entrypoint must create `/tmp/poxey-home` and `/run/poxey` as UID 1000.
- Memory+swap ceiling is memory plus 1 MiB to satisfy Podman's documented
  greater-than-memory requirement. Inspect actual cgroup limits on Linux; these
  sample numbers are not proven Chrome resource budgets.
- Cleanup plans require an inspected exact container ID, matching owner/session
  labels and expected name. No prune, wildcard or unrelated-resource cleanup.

Example (specification only, no execution):

```js
import { offlineWorkerSpec } from './deploy/isolation/worker-spec.mjs'
const spec = offlineWorkerSpec({
  sessionId: crypto.randomUUID(),
  image: 'registry.example/poxey/worker@sha256:' + 'a'.repeat(64),
  cpuMillis: 500, memoryMiB: 1024, pids: 256, tmpMiB: 128, shmMiB: 128,
})
// spec.executable and spec.args are a future adapter's inputs, not shell text.
// The illustrative image does not exist and the resource values are not capacity claims.
```

`npm run test:isolation-plan` tests prerequisite evaluation and this specification.
The cleanup function returns a plan only: a future executor must inspect ownership,
stop successfully, remove, and verify absence; it must handle partial startup too.

## Environment result

Read-only Codespace qualification on October 13: Linux/non-root execution and
nested user namespaces passed. Supported Podman/rootless operation, delegated
CPU/memory/PID limits, cgroup-v2 qualification and sufficient subordinate ID ranges
did not qualify. No Podman integration was attempted. Missing Podman information
means the checker cannot establish cgroup properties, not that the kernel is proven
to use cgroup v1. macOS also cannot run this Linux prototype natively.

Later Phase 3 direct checks found cgroup-v2 CPU/memory/PID controllers exposed and
the cgroup subtree-control path writable, with nested user namespaces allowed.
Podman is still absent. The service account has 65,536 subordinate UIDs and GIDs,
below the design's 327,680 for five workers. Delegation inside an actual rootless
runtime remains unqualified. No packages, ID mappings or security policy were
changed to bypass those blockers.

Neither environment proves Chrome sandbox compatibility, enforced cgroup limits,
private X11/PulseAudio, cross-worker isolation or cleanup of actual containers.
Execute ISO-01 through ISO-12 in `IMPLEMENTATION.md` on a qualified Linux host.
Do not relax seccomp, capabilities, AppArmor or SELinux to force a passing result.

Flag semantics were checked against the official
[Podman run reference](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
Keeping read-only tmpfs enabled matters: disabling it also makes `/dev/shm`
read-only, unsuitable for the intended Chrome worker. Exact behavior still needs
Linux integration with the eventual image and installed Podman version.
