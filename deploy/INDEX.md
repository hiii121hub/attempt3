# Engineering documentation index

Start with the [README](../README.md). These are current operational references:

- [Identity recovery/persistence](IDENTITY-RECOVERY.md)
- [Deployment candidate](README.md)
- [Host and release acceptance](SERVER-ACCEPTANCE.md)
- [Allowance threat model](ALLOWANCE-THREAT-MODEL.md)
- [Capacity preparation](CAPACITY-PREPARATION.md)
- [Disposable load harness](LOAD-TEST.md)
- [Isolation implementation](isolation/IMPLEMENTATION.md)
- [Offline specification](isolation/OFFLINE-SPEC.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Cleanup results](CLEANUP-REPORT.md)

## Historical checkpoints — retained, not deleted

Newest first; old test totals can include duplicate JS/TS suites.

1. [Phase 4.2](PHASE4.2-RESULTS.md): offline isolation/load harness.
2. [Phase 4.1](PHASE4.1-RESULTS.md): recovery safeguards, activation blocked.
3. [Phase 4 recovery](PHASE4-RECOVERY.md).
4. [Phase 3](PHASE3-HANDOFF.md).
5. [October 13 sprint](SPRINT-2026-10-13.md).
6. [Phase 2 Linux tests](PHASE2-LIVE-TEST.md) and [handoff](PHASE2-HANDOFF.md).
7. [Earlier security validation](VALIDATION.md).

The [PoC guide](../POC_README.md), root `src/` and Vite configs, unused frontend
proxy components and duplicate vendored layout remain preserved pending dedicated
provenance/reference review. They are not current startup instructions.
Explicit `.before-*` files are backups: never execute or delete them as cleanup.
All branches and old PR #1 remain intact. Cleanup targets the engineering branch
rather than silently combining diverged historical variants.
