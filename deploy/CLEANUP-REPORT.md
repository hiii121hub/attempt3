# Repository cleanup — October 14, 2026

Baseline: engineering branch `fix/phase2-reliability-isolation`,
`2242e2e883897db7051801484d5c7c0b8b52ea39`; initially clean, one local worktree.
Cleanup branch: `cleanup/developer-handoff`. PR targets engineering, not `main`.

## Review and changes

Reviewed all nine remote refs (including origin/HEAD), three local branches,
worktree/remotes, engineering/main differences, file inventory, package manifests,
startup/security/accounting paths, isolation/load-test preparation and historical
reports. Open PR #1 is the older audio branch into main; no open issues were
returned. Two historical branches have commits outside engineering ancestry:
`before-session-lifecycle-fix` and `fix/touch-after-resize`. They are retained;
no automatic merge/cherry-pick or replacement of current touch code was attempted.

- Replaced obsolete proxy-only README with actual Chrome architecture and guarded
  setup. Added contribution/security/troubleshooting guides and documentation index.
  Historical reports and PoC guide remain intact; PoC now has an obsolete warning.
- Root `npm test` now runs all offline suites once instead of hanging in watch
  mode. Added combined build and repository-hygiene regression checks.
- Removed nine byte-identical TypeScript-compiled worker JS files, confirmed with
  the installed TypeScript compiler before deletion. Four were duplicate test
  suites. Retained the unique JS-only `index.test.js` security suite. `noEmit`
  prevents builds recreating shadow JS next to TS; Wrangler already uses TS.
- Disabled three unused historical entrypoints before side effects: shared global
  unauthenticated audio, shared unauthenticated Chrome/VNC startup, and a legacy
  stop script with broad process kills/deletion. Source remains available. Normal
  startup uses the authenticated session manager, not these scripts.
- Removed legacy worker request/redirect debug logs exposing browsing destinations.
- Added scoped ignores for private credentials/accounting/logs and restored
  third-party MPL/pako notices in the static distribution. No project license chosen.

Root legacy configs, frontend JS with differences from TS, unused prototype
components, duplicate noVNC layout, explicit backup files and assets remain:
their removal was not sufficiently proven safe in this focused cleanup.

## Verification

Environment: macOS, Node v26.8.2, npm 11.19.1. These are offline checks, not Linux
integration. No claim of validation on another Node major is made.

An initial worker test attempt hit sandbox temporary-directory permission errors
(zero tests executed). Rerun with approved `TMPDIR=/private/tmp` passed.
Before cleanup: worker 77 results. After duplicate removal: 41 distinct tests,
with all five unique entrypoint tests retained; this is not lost coverage.

| Final verification | Result |
|---|---|
| Backend (accounting, security, audio, capacity, cleanup, isolation, harness, hygiene) | 254 passed |
| Frontend (launch, heartbeat, pagehide) | 28 passed |
| Worker (distinct suites, including unique JS security tests) | 41 passed |
| Total | 323 passed; zero failed, cancelled or skipped |
| Frontend production build | Passed; unchanged CSS/JS artifact names |
| Worker TypeScript build | Passed; no generated source JS |
| Diff whitespace check | Passed |

Frontend assets remain `index-DLy7q3rK.css` and `index-C4Sp4kB9.js`; only static
third-party notices are added. The sandbox initially denied OS temporary storage;
the successful runs used approved `/private/tmp`, not weaker state permissions.

Audit on October 14: production-only zero findings; full audit six affected
development-tool packages (two critical, one high, three moderate): Vitest,
tinypool, Vite, vite-node, esbuild and @vitejs/plugin-react. No forced major upgrade
or lockfile mutation. Never expose development/UI servers. A dedicated tested
toolchain upgrade is required; zero production findings is not a security proof.

Selected private-key/GitHub/AWS/Google credential-pattern scan of all reachable
Git refs examined 391 unique blobs, zero matches. No secret values were printed.
This does not detect arbitrary secrets, deleted unreachable objects or remote
provider state. License history contained no project LICENSE. Vendored revision
and image rights remain unresolved: see [third-party notices](../THIRD_PARTY_NOTICES.md).

## Preserved and not verified

No UI/CSS/input, Chrome size, VNC routes, frontend audio code, session-manager
behavior, timer, recovery code or manifest was changed. No real-user records,
recovery backups, original Codespace files or lockfiles were touched. No new live
key, website, public listener, deployment or main merge was activated.

The historical 20.530-second cold-start/audio timeout's exact cause remains
unproven; later tone/probe checks are not a blanket cold-playback guarantee.
Live recovery still needs independent gate/boot/idle/ledger verification before
activation. Production container worker image/egress/relays/lifecycle recovery
and manager integration remain unfinished. Linux sandbox/isolation enforcement,
five active connected viewers for 15–20 minutes, actual audible browser playback,
latest Safari/touch/Chromebook regressions and qualifying free hosting remain
unverified. Historical live checks are not new cleanup test results.

Ready for developer handoff with explicit limitations, not public deployment.
The subsequent owner-approved MIT addition covers only Poxey code they own;
see [license scope/review](LICENSE-REVIEW.md). Merging and deployment still need
approval. The initial cleanup's license-pending observations above are historical.
