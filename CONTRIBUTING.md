# Contributing

After the approved integration, base new topic branches on `main`.
Inspect status/worktrees first. Preserve modified lockfiles, backups and recovery
data. Never reset, force-push, merge or deploy without authorization.

Read [the documentation index](deploy/INDEX.md). Reproduce a problem, make a
targeted change and include tests plus an honest verification report in a PR.
Poxey-owned code uses the [MIT license](LICENSE). Keep third-party terms separate;
see [scope and unresolved permissions](deploy/LICENSE-REVIEW.md).
Submit only contributions you have the right to license under MIT and identify
any third-party material and its applicable license.

## Verification

```sh
npm ci
npm test
npm run build
npm audit --omit=dev
npm audit
git diff --check
```

Offline tests do not start the real website. Full audit has development-tool
findings: do not hide them or use `npm audit fix --force`. Toolchain upgrades
need dedicated compatibility testing. Worker build must not emit JavaScript
beside TypeScript. Preserve its unique JS-only entrypoint security tests.

Preserve UI/CSS, real Chrome, sizing, touch/input, routes, per-session audio,
authentication, the 25-minute/24-hour allowance, refresh-to-home, profile cleanup,
accounting persistence and launch/capacity protections. Never weaken sandboxing
or identity enforcement for a passing test.

Use disposable synthetic state only. Never print or commit keys, cookies, tokens,
real usage, profiles or browsing contents. Do not run live benchmarks against
blocked recovery or the original protected Codespace.

Linux results must identify revision, host, workload, duration, metrics and failures.
Mock Podman tests are not container enforcement. Created sessions are not active
viewers. PCM bytes are not audible playback. Mark blocked tests honestly.

Historical code and explicit backups remain preserved, not supported entrypoints.
Do not execute `.before-*` managers or legacy shared-browser/audio scripts.
Normal startup uses `frontend/vite.config.ts`, not the root historical config.
