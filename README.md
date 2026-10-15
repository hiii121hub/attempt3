# Poxey X1

Poxey X1 runs real Google Chrome on Linux and streams its display to a browser
using VNC/noVNC. The React client sends keyboard, pointer and touch input back.
Authenticated WebSockets carry VNC and per-session PulseAudio/FFmpeg audio.

**Engineering preview, not approved for public multi-user deployment.**
Latest development: `fix/phase2-reliability-isolation`. The older `main` and
audio PR do not include all completed engineering improvements.
Start with [the documentation index](deploy/INDEX.md).

## Architecture

- `frontend/`: React/Vite UI, noVNC in `public/core/`, audio worklet.
- `scripts/poxey-session-manager.mjs`: admission, Chrome/Xvfb/x11vnc lifecycle,
  signed browser identities, accounting and authenticated VNC/audio.
- Manager: loopback **3997**. Development frontend: **3999**.
- `/__poxey_session/*` proxies HTTP; `/websockify` and `/audio` proxy
  authenticated WebSockets to the manager.
- `deploy/`: Caddy/systemd candidates, acceptance gates, offline Podman adapter.
- `worker/`: retained Cloudflare HTTP-proxy prototype, **not** the Chrome backend.

Separate profiles/displays/sinks are not hostile-user security boundaries.
Native sessions still share a Linux account, network and PulseAudio server.
The container adapter is offline preparation, not integrated production isolation.

## Install and verify without starting a service

Use a new checkout; never overwrite existing changes, lockfiles, backups or state.
Recent Node.js/npm with workspaces are required; exact tested versions are in
[the cleanup report](deploy/CLEANUP-REPORT.md).

```sh
git clone --branch fix/phase2-reliability-isolation https://github.com/hiii121hub/attempt3.git
cd attempt3
npm ci
npm test
npm run build
npm audit --omit=dev
```

After this cleanup PR is merged into the engineering branch, these commands use
the cleaned setup. Until then, check out the PR's cleanup branch to test it.
`npm test` runs all offline backend, frontend and worker suites once and exits.
Workspace test commands alone retain watch mode. Tests use synthetic state,
never real-user records. Builds do not start Chrome or deploy anything.
Worker build validates TypeScript; Wrangler bundles `src/index.ts` directly.

macOS supports offline tests/builds; the Chrome backend requires Linux.
Do not use a Mac as a public host.

## Linux dependencies

Use Linux x86-64, non-root execution, Google Chrome at
`/usr/bin/google-chrome`, Node.js/npm, Bash, Xvfb, x11vnc, xdotool,
PulseAudio (`pulseaudio`, `pactl`), FFmpeg, util-linux (`unshare`),
curl, fonts and CA certificates. Distribution package names include `xvfb`,
`x11vnc`, `xdotool`, `pulseaudio`, `pulseaudio-utils`, and `ffmpeg`.
Install Chrome from its official signed package, not an unreviewed shell installer.

Production additionally needs qualified rootless Podman, delegated cgroup-v2,
subordinate UID/GID ranges, sandbox-compatible user namespaces, HTTPS/WSS and
persistent private storage. See [server requirements](deploy/SERVER-ACCEPTANCE.md).
Hardware budgets there are planning inputs, not measured five-user benchmarks.

## Accounting state must be ready before startup

**Never generate a new key, fabricate an empty ledger, clear cookies for time,
or bypass an identity-state error.** Missing/damaged/blocked state refuses startup
before services or admission. A fresh checkout does not authorize resetting usage.

Read [identity recovery/persistence](deploy/IDENTITY-RECOVERY.md).
The original Codespace recovery was blocked at the latest checkpoint; this
cleanup does not activate it. New installations need reviewed operator
provisioning: no automatic empty-state bootstrap exists.

The original Codespace uses `/workspaces/.poxey-state/attempt3`; other checkouts
default to sibling `.poxey-state/<checkout-name>`. `POXEY_STATE_DIR` can select
reviewed persistent storage outside Git and temporary directories.
Directory: 0700; private files: 0600. Protect ledger, key and manifest together.
Never commit or publicly upload them.

Only on an authorized private Linux host with verified ready state:

```sh
cd /workspaces/attempt3
npm run dev
```

Use the actual checkout path on other hosts. Open private forwarded port 3999.
Keep manager, VNC and audio ports private. Vite binds all interfaces for private
forwarding; never expose it publicly. Stop the owning foreground process,
not unrelated Chrome sessions or broad process patterns.

## Existing behavior and limits

Allowance: **25 minutes per signed browser identity per 24-hour window**,
not an absolute per-person quota. Cookie deletion/new browsers can create
distinct identities: [threat model](deploy/ALLOWANCE-THREAT-MODEL.md).
Refresh ends the session, returns home and retains usage; no automatic reconnect.
Termination/expiry removes temporary profiles, owned processes and session sinks,
not persistent accounting.

`POXEY_MAX_SESSIONS` controls admission; production defaults to one supervised
tester. Five is configurable, **not verified active-user capacity**.
See [capacity preparation](deploy/CAPACITY-PREPARATION.md). Historical three
viewers/five Chrome creations do not establish five sustained active users.

## Production and unfinished work

Build static assets; do not serve production through Vite.
Review [Linux/Caddy/systemd deployment](deploy/README.md).
Public release remains blocked by real production isolation, suitable hosting,
five sustained independent viewers with browsing/video/audible audio,
newest Safari/mobile/Chromebook tests and final security acceptance.
The [disposable load harness](deploy/LOAD-TEST.md) is not human acceptance.

No permanent $0/no-card backend is verified. Cloudflare Pages cannot provide
the Chrome backend. Development-tool advisories remain; never expose
Vite/Vitest UI. No deployment or main merge is authorized by this cleanup.

## Help, contributions and licensing

- [Troubleshooting](deploy/TROUBLESHOOTING.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Poxey code owned by hiii121hub is licensed under [MIT](LICENSE),
Copyright (c) 2026 hiii121hub. This grant does not relicense third-party code,
contributions whose rights are unconfirmed, logos, images or trademarks.
See [license scope and provenance review](deploy/LICENSE-REVIEW.md).
Third-party terms remain separate; unresolved asset/contributor permissions
prevent claiming that the entire repository is cleared for redistribution.
