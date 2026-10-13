# Poxey X1: Linux deployment candidate and release gates

Prepared October 13, 2026. **Not deployed, not approved for public multi-user release.**
Real Google Chrome, Xvfb, x11vnc, noVNC, PulseAudio and FFmpeg remain unchanged in role.
The frontend is built once and served as static files. Vite is not a production service.

## What is implemented

- `NODE_ENV=production` requires Linux, a non-root service account, one explicit HTTPS origin, and persistent allowance storage outside `/tmp`.
- Production Chrome omits `--no-sandbox`. Startup checks unprivileged user namespaces and has no insecure fallback. Development keeps the existing Chrome flags.
- Browser child processes receive an environment allowlist, not GitHub/cloud credentials or the allowance-signing secret.
- Production POST and WebSocket requests require the configured Origin and HTTPS forwarding. Session operations additionally require the signed cookie belonging to that session. Tokens alone are insufficient in production.
- Tokens are rejected at expiry, before the next periodic sweep. Production limits each session to two audio and two VNC connections (brief reconnect overlap), with 1 MiB inbound WebSocket messages.
- Malformed cookies and non-object JSON are rejected without an uncaught parsing/type error.
- Production cookies always have Secure, HttpOnly and SameSite=Lax. The 25-minute allowance and 24-hour window are unchanged. Corrupt production ledger JSON fails closed instead of silently resetting usage.
- `POXEY_MAX_SESSIONS` accepts integers 1–100. Development defaults to 100; production defaults to one supervised tester. `5` is configurable, **not a capacity guarantee**.
- `ws` is now a direct production dependency; the inherited `source-map-js` 1.2.2 lockfile fix is retained.

## Release-blocking isolation gap

The manager still starts sessions under a shared OS account, sharing host networking and a PulseAudio server. Different profiles/displays/sinks and token checks do **not** establish a hostile-user security boundary. Chrome's renderer sandbox is important but does not isolate the entire browser process from the manager or other users.

Do not invite untrusted users or set the public cap to five until a per-session runtime has been implemented and tested. Required boundary: separate unprivileged identity plus filesystem, PID, IPC and network isolation for each Chrome/Xvfb/VNC/audio stack; no manager state, repository, credentials, host sockets or other profiles mounted into sessions. Permit outbound web traffic but deny host services, other sessions and cloud metadata/private networks. PulseAudio and X sockets must also be session-private. Do not mount a Docker socket into Chrome containers or use privileged containers.

Keep the existing browser engine, display settings, HTTP/WS endpoints, token semantics, lifecycle and a single durable allowance ledger when implementing that runtime. A single container around the whole existing stack is **not** sufficient. A native Linux host and deployment decision are needed to validate the appropriate rootless container or VM boundary. This branch deliberately does not invent an untested isolation implementation or simply claim that `--no-sandbox` removal solves it.

Other open gates:

- Cookie deletion/new profiles can evade device-based free usage. No new fingerprinting or login system was added. Public admission/rate limits and a reviewed beta access policy are still needed.
- Production message/connection limits and cookie-bound authorization need real Safari/mobile reconnect and audio tests.
- Phase 2 now routes startup failures through one resource rollback, including sink removal and all owned processes. Local rollback tests pass; actual Linux/PulseAudio fault injection remains unverified. A full service stop kills its dedicated PulseAudio process via systemd. See `PHASE2-HANDOFF.md` and `isolation/IMPLEMENTATION.md` for the checkpoint and isolation acceptance plan.
- Token query parameters can leak through proxy error/access logs. This candidate does not enable Caddy access logs. Any later logging/monitoring must redact query tokens, Cookie and Authorization, including upstream/CDN logs.
- The complete dependency audit still flags five development-tool packages (two critical, one high, two moderate), despite zero production findings. Vite/Vitest development/UI servers must never run on the production host or be exposed publicly. A separately tested Vite/Vitest/toolchain upgrade is required; do not use `npm audit fix --force` as a release shortcut. Production installation omits those tools.
- Backend loopback binding is not protection from a malicious Chrome session sharing the same network namespace. Origin/cookie checks are defense in depth, not a substitute for network isolation.

## Hosting decision for October 15

No account-verified, permanent $0/no-card/always-on backend has been established. Do not activate credits, upgrade an account, create a VM or change DNS/Cloudflare without approval.

- **Conditional candidate: Azure for Students.** The official offer provides $100 for 12 months without a credit card, with age 18+, full-time eligible higher-education enrollment and academic verification requirements. Eligibility, activation, regional Linux VM quota, machine size and bandwidth budget are unverified. Credits are finite; service is disabled when exhausted. This is not a promise of permanent free five-user hosting. Review the applicable usage terms for the intended beta before deployment. [Offer and eligibility](https://azure.microsoft.com/en-us/pricing/offers/ms-azr-0170p/).
- GitHub's separate 13–17 Azure benefit lists App Services/Functions and related services, not an unrestricted Linux VM entitlement. Do not assume the same compute credits. [Actual Student Pack offers](https://education.github.com/pack).
- Codespaces remains a development/testing environment; GitHub disallows production-facing hosting. Do not keep it alive as a production workaround. [Codespaces terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#codespaces).
- Cloudflare Pages can serve frontend assets; Tunnel connects existing compute and does not supply it. Containers requires Workers Paid, so it is outside the $0 rule. No Cloudflare settings were changed. [Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/).
- Render Free sleeps after inactivity and has limited free hours/resources; it is not a validated five-Chrome always-on host. Koyeb requires a credit card. Current Hugging Face documentation requires a paid plan to create Docker Spaces. None is a qualifying replacement. [Render](https://render.com/docs/free), [Koyeb](https://www.koyeb.com/docs/faqs/pricing), [Hugging Face](https://huggingface.co/docs/hub/spaces-overview).

If Azure is unavailable or the VM/egress budget is insufficient, postpone public release or obtain explicitly sponsored Linux capacity. Do not sign up for trials requiring a card or substitute a different browser engine. The previously observed 2 vCPU / 7,942 MiB Codespace is a test reference, not proven five-active-user sizing. Use Linux x86-64 for the current `/usr/bin/google-chrome` deployment; ARM compatibility is not established.

## Server preparation (instructions only; not executed)

Use a dedicated, patched Linux VM with systemd, no unrelated tenants or developer credentials. Provision only after hosting eligibility and spending limits are confirmed. Keep the firewall closed except restricted administrator SSH during staging. Do not expose 3997, 3999, VNC 5900+, PulseAudio, or Chrome debugging ports. The candidate Caddyfile defaults to loopback binding.

Install current supported Node.js (validate Node 24 LTS), Google Chrome stable at `/usr/bin/google-chrome`, Caddy 2.8+ from official packages, and distribution packages for `pulseaudio`, `pulseaudio-utils`, `ffmpeg`, `xvfb`, `x11vnc`, `xdotool`, `util-linux`, `curl`, fonts and CA certificates. Use vendor signing keys/package verification. Do not run arbitrary curl-to-shell installers. [Caddy installation](https://caddyserver.com/docs/install).

Create a dedicated `poxey` non-root user and group without sudo or an interactive login. Put a **new, reviewed checkout** at `/opt/poxey`, root-owned and not writable by the service. Never overwrite the original Codespace checkout or its modified lockfile. Build in a separate builder directory as a non-root deployment user:

```sh
npm ci
npm run test:security
npm run test --workspace frontend -- --run
npm run test --workspace worker -- --run
npm run frontend:build
npm run worker:build
npm audit --omit=dev
```

Publish `frontend/dist/` into an empty versioned static release directory and point `/srv/poxey/frontend` at it. Include the copied `/core/` noVNC files and `/poxey-audio-worklet.js`, not just `index.html` and assets. Retain the previous release for recovery; do not delete or overwrite backups. Install backend dependencies from the reviewed lockfile with `npm ci --omit=dev --ignore-scripts` in the new backend release. A production-only `ws` import is covered by verification.

Install `deploy/poxey.service` as `/etc/systemd/system/poxey.service`. Copy `deploy/poxey.env.example` to `/etc/poxey/poxey.env`, root:poxey mode 0640, then set the exact origin, e.g. `https://your-approved-domain.example`, persistent directory `/var/lib/poxey/state`, and initial cap `1`. Do not put real secrets in Git.

Before migrating an existing service, end only authorized sessions and preserve its existing cookie-signing secret and `poxey-free-usage.json` in a protected backup. Copy those exact files into the configured state directory with service ownership/mode 0600. Do not initialize an empty ledger over existing usage. Keep `/tmp/poxey-sessions` solely for ephemeral profiles in production; never clean `/var/lib/poxey/state` as part of session cleanup.

Configure Caddy's service environment with `POXEY_HOSTNAME` matching the HTTPS origin's DNS hostname; this template uses standard ports 80/443. Keep `POXEY_BIND=127.0.0.1` during private staging. Both the explicit HTTP redirect site and HTTPS site use that binding; do not rely on Caddy's automatically created redirect listener inheriting a site bind. Copy the candidate Caddyfile to an approved configuration location. Caddy preserves `/websockify` and `/audio`, strips only `/__poxey_session`, serves static assets and sets HTTPS forwarding itself. Do not enable TLS verification bypasses. Automatic public certificates require an approved hostname and ACME challenge reachability; local config validation does not issue or prove a certificate.

```sh
# On the deployment server only; substitute the approved hostname.
sudo systemd-analyze verify /etc/systemd/system/poxey.service
POXEY_HOSTNAME=your-approved-domain.example caddy validate --config deploy/Caddyfile --adapter caddyfile
sudo systemctl daemon-reload
sudo systemctl start poxey
curl --fail --silent http://127.0.0.1:3997/health
sudo systemctl status poxey --no-pager
```

The namespace preflight must succeed **inside the service**. Ubuntu/AppArmor and provider policies can disallow user namespaces. Configure an appropriate narrowly scoped host policy after reviewing the error; do not disable AppArmor globally, run Chrome as root, or restore `--no-sandbox` in production. Verify `chrome://sandbox` inside a real test session as well; successful `unshare` alone does not prove Chrome's complete sandbox. [Chromium sandbox design](https://chromium.googlesource.com/chromium/src/+/main/docs/design/sandbox.md).

## Operations and health checks

- `curl --fail http://127.0.0.1:3997/health` is a manager liveness/count check, not proof of Chrome, audio or sandbox readiness. Health endpoints are not published by the proxy.
- `systemctl restart poxey` ends active sessions; schedule it and notify testers. systemd restarts abnormal exits with rate limiting and kills the whole service process group on stop. Never use broad `pkill` commands.
- Caddy's administration API is disabled. Validate configuration before a scheduled Caddy restart; API-based `caddy reload` will not work with this candidate. A proxy restart can interrupt viewers, so do not do it during live testing.
- `systemctl stop poxey` should leave no service-owned Chrome/Xvfb/x11vnc/FFmpeg/PulseAudio processes. Check `systemctl show poxey -p ControlGroup` and the service cgroup; do not kill unrelated processes.
- Normal end/expiry should remove that session's profile directory and sink, retaining the usage ledger and signing secret. Inspect metadata/counts, not tokens or browsing contents. PrivateTmp means the host's `/tmp` is not the service's private `/tmp`.
- After a crash/restart, verify all old profiles/resources are gone and no old token works. Verify allowance persistence across restart and reboot. Never reset the ledger to make a test pass.
- Review redacted `journalctl -u poxey` and `journalctl -u caddy` for startup/error diagnostics. Configure CPU/RAM/PID/egress limits and alert thresholds using actual target-host measurements; no arbitrary five-user resource reservation is asserted here.

## Required release test sequence

1. Private single-viewer staging: Linux service startup, real Chrome sandbox, static noVNC import, authenticated WSS, cookie Secure/HttpOnly, typing/clicking/touch/resizing, HTML5 video and **human-confirmed audible** audio. Test Safari cookie-bound reconnect. Reject missing/wrong Origin, wrong-device cookies, invalid/expired tokens and excessive sockets. Ensure external backend/VNC ports are unreachable.
2. Implement/validate the per-session OS/network/audio boundary described above. Use canary files and test accounts; do not expose actual secrets. Prove one user cannot read another profile, reach another display/VNC/audio sink, manager state, host services or cloud metadata. Test forced startup failures and crash cleanup. Complete an actual 25-minute expiry/relaunch/refresh test without changing the timer.
3. Only then set `POXEY_MAX_SESSIONS=5` for a supervised host test: three then five actual independent noVNC viewers, real interaction, multiple tabs, permitted video, authenticated audio, 15–20 minutes. Record CPU, RAM, OOM, bandwidth, input latency, video update rate, audible stalls, disconnects and cleanup. Stop on resource pressure. Launch publicly only after those gates and explicit approval to expose Caddy/DNS; otherwise October 16 remains no-go.

Do not run `scripts/test-session-launch.mjs` against production: it intentionally has no browser cookies/Origin and uses five real Chrome launches. It is a development-only integration test and is not part of low-cost production preparation.
