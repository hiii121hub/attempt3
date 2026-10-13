# Production preparation validation — October 13, 2026

Branch: `fix/production-security-preparation`.
Base: `592ee1696a5d4953d2efb5f7aef59a2bedb90672` (`fix/source-map-js-security`), which includes the earlier launch repair.
Environment: local macOS ARM64. No new Codespace Chrome benchmark, cloud resource, public deployment or main-branch merge was performed for this production-preparation task.

## Actual results

| Command/check | Result |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS; installed the committed lockfile, including source-map-js 1.2.2 and ws 8.21.0 |
| `npm run test:security` | PASS: 39 tests; policy unit tests and static deployment/wiring guards |
| `npm run test --workspace frontend -- --run` | PASS: 26 tests in 3 files |
| `npm run test --workspace worker -- --run` | PASS: 77 tests in 9 files; existing JS/TS duplicate suites included in this runner count |
| `npm run frontend:build` | PASS: TypeScript + Vite; 36 modules |
| `npm run worker:build` | PASS: TypeScript |
| `node --check scripts/poxey-session-manager.mjs` | PASS |
| `bash -n scripts/start-production.sh` | PASS |
| `npm audit --omit=dev --json` | PASS: zero known production vulnerabilities |
| `npm audit --json` | NOT CLEAN: 5 affected development-tool packages, 2 critical / 1 high / 2 moderate |
| Fresh temporary `npm ci --omit=dev --ignore-scripts --offline --no-audit --no-fund`, then import ws | PASS: 31 installed packages; WebSocketServer imports as a function |
| Caddy 2.11.7 `validate --config deploy/Caddyfile --adapter caddyfile` | PASS: Valid configuration |
| Caddy adapted JSON | PASS: only `127.0.0.1:80` and `127.0.0.1:443`; admin API disabled |
| `git diff --check` | PASS |
| Diff of frontend, worker, development startup, legacy audio and remote-browser startup against base | No changes |

**Total automated test-runner results: 142 passed, zero failed.** These include unit tests and static guards, not 142 live-browser/security penetration tests.

The frontend output remains `index-DLy7q3rK.css` (7.88 kB) and `index-C4Sp4kB9.js` (161.72 kB). `/core/rfb.js` and `/poxey-audio-worklet.js` are present in the built static tree. No UI, CSS, touch, sizing or frontend audio source was changed.

Caddy was downloaded from its official GitHub release to a temporary local directory and its SHA-512 matched the published checksum. Only its formatter/configuration validator/adapter were run; no Caddy server was started, no trust certificate installed, and no system-level package was installed.

An initial offline full dependency install could not find source-map-js 1.2.2 in the cache. The subsequent online lockfile install succeeded, and **all tests/builds above were rerun with 1.2.2 actually installed**. The Codespace lockfile was not touched.

## Security test coverage

- Development defaults remain compatible (100 cap, existing temporary state path, existing Chrome sandbox flag).
- Production requires a non-root Linux runtime, a canonical HTTPS origin, persistent state and a valid 1–100 cap; a cap of five is accepted.
- Missing, forged, cross-origin and non-HTTPS forwarded requests are denied by the policy.
- Expired/cleaning sessions fail authorization at the exact boundary.
- Child-process environments exclude GitHub/cloud/signing credentials and injection-related environment variables.
- VNC/audio policy requires the owning device, live session and correct origin.
- Per-route two-client overlap limit is enforced and released on disconnect.
- Malformed/non-object JSON and malformed URI cookie encoding cannot escape their parsing guards.
- Static guards check that the manager actually wires the policy into all three session-token POST handlers and WebSocket upgrades, and that dimensions/timer/loopback constants remain intact.
- Deployment guards check runtime dependency metadata, path rewriting, private listener configuration, service process-group termination settings and shell syntax.

## Not verified here

- Linux systemd unit execution, `systemd-analyze verify`, host user namespaces/AppArmor behavior, Chrome's actual sandbox, PulseAudio discovery under the unit, or service stop/reboot behavior.
- Real TLS certificate issuance, external firewall rules, end-to-end WSS through Caddy or Safari cookie-bound reconnect.
- Per-session OS/network/PulseAudio isolation. This remains a known architectural release blocker; shared UID/network/audio-server use is not solved by these policy tests.
- Five active connected viewers, sustained video, audible audio, input latency, bandwidth or a safe concurrency limit.
- Full 25-minute expiration on the new production configuration, persistent-ledger migration/reboot checks, or startup-failure fault injection.

Earlier live development tests established five concurrent real Chrome creations and valid/invalid VNC/audio token probes. They do not validate this new production configuration or establish five-active-user capacity. No new live Chrome load was generated during this task, respecting the Codespace budget request.

## Release decision

Ready for code review and **private Linux staging preparation**, not public multi-user launch. See `deploy/README.md` for setup, security boundaries, hosting eligibility and the three mandatory release gates. No permanent $0/no-card Linux host or activated Student benefit was verified.
