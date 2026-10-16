# Private identity/accounting recovery — Phase 4.1

Startup never creates a signing key or an empty allowance ledger. This applies
to development as well as production. Missing, damaged, replaced, inaccessible,
or incorrectly permissioned state blocks startup before PulseAudio, Vite, runtime
files or session admission. A later integrity failure returns HTTP 503 (including
health) and refuses WebSocket upgrades. Do not bypass this guard.

## Storage and unchanged policy

The original `/workspaces/attempt3` checkout automatically uses
`/workspaces/.poxey-state/attempt3`; the everyday command remains
`cd /workspaces/attempt3 && npm run dev`. Other checkouts default to a sibling
`.poxey-state/<checkout-name>`. `POXEY_STATE_DIR` can explicitly select persistent
storage; production still requires it. Paths inside this repository or temporary
directories are rejected. Do not run the application as another account to evade
ownership checks.

State directory: owner-only 0700. Ledger, signing key and integrity manifest:
owner-only regular files 0600, no symlinks/hardlinks. The manifest records the
recovery phase, file checksums and waiting gate; it contains no key or identities.
`POXEY_FREE_COOKIE_SECRET`, if configured, must match the persisted key; it cannot
silently override it. Never put state, cookies or secret values in Git, shell
history, logs, frontend files, build artifacts or public storage.

The policy is still 25 minutes per signed browser identity within its existing
24-hour window. Ending/refreshing a session retains consumption; renewal occurs
only at the original normal window boundary. Refresh still ends the remote
session and returns home; there is no automatic reconnect. Profile teardown only
removes ephemeral session data, not this state directory.

## Unrecoverable-key procedure (explicit operator action)

1. Stop admission; inspect all relevant checkouts, processes, listeners, profile
   metadata, sinks and available backups without displaying browsing data or
   credentials. Preserve the exact surviving ledger and its SHA-256. Search
   authorized persistent sources for the original key first. If it is found,
   retain it and arrange a reviewed same-key import; do not rotate unnecessarily.
2. Establish that the source ledger is valid, private and owned by the operator.
   Preserve the original recovery archive. Do not fabricate an empty ledger or
   normalize/rewrite records. These commands must run as the intended Linux
   service user on an idle host. The destination must be new or empty:

   ```sh
   cd /workspaces/attempt3
   node scripts/accounting-recovery.mjs prepare /workspaces/.poxey-state/attempt3 /workspaces/poxey-phase4-backup.3BVWya/usage.before.json
   ```

   Preparation copies the ledger **byte-for-byte**, pins its checksum, writes a
   blocked manifest and creates **no key**. The original source stays untouched.
   The CLI checks ports 3997/3999, Chrome/Xvfb/VNC/FFmpeg processes, legacy runtime
   state and Poxey PulseAudio sinks; uncertainty refuses the operation.
3. Keep the verified application stopped/blocked. The backup is not proven to be
   the final pre-crash snapshot. Therefore the gate is the later of every recorded
   window end and **24 hours after this idle observation**. Expiry of just one
   recorded user is insufficient. Both wall-clock time and same-boot elapsed
   uptime must satisfy this interval; a clock jump cannot shorten it. Maintain
   private ports and do not run older code, another manager or a test harness
   against real user state during this interval. Any evidence of intervening
   usage, another live service or an unaccounted host requires renewed review.
4. At/after the printed `notBeforeUTC`, recheck the original checkout and all
   evidence. The activation CLI independently repeats idle inspection, verifies
   the same boot, elapsed uptime, ledger checksum, schema and **every** window.
   Only then may the authorized operator run:

   ```sh
   node scripts/accounting-recovery.mjs activate /workspaces/.poxey-state/attempt3
   ```

   There is no CLI clock override, force switch or automatic activation. It
   generates a cryptographically random 256-bit key using exclusive creation,
   durable writes and 0600 permissions, then commits the ready phase. Old
   signatures are explicitly invalidated. No historical allowance record is
   erased or replenished by this operation.
5. Verify checksum/permissions and startup, restart, authorized streams, refresh,
   profile deletion and accounting. Real audible playback/input require actual
   client tests. Never treat a successful unit test as a live browser result.

If the host reboots during the blocked interval, the boot check fails closed.
Use the read-only status command to distinguish that condition from corrupt or
missing state, without exposing any user record or key:

```sh
node scripts/accounting-recovery.mjs status /workspaces/.poxey-state/attempt3
```

From the intended checkout, `npm run accounting:status` automatically selects
the same configured state directory as normal startup; it is also read-only.

Status returns exit 0 only for intact ready accounting, exit 2 for blocked/invalid
accounting, and exit 1 for an inspection/command failure. It never creates files,
starts services or generates keys. `ELIGIBLE_FOR_IDLE_HOST_RECHECK` is **not**
permission to start: activation still independently checks host quiescence.
`RECOVERY_BOOT_CHANGED` means the original wait cannot authorize activation.

After an operator reviews **all** potentially active Codespaces/checkouts and
confirms no intervening/unaccounted service remains, `reobserve` automates the
previously manual new-destination procedure. It accepts only a private,
checksum-verified blocked source with no key or ambiguous extra files and a
different boot. It requires an idle Linux host and a new disjoint destination.
Example paths below are instructions, not an operation performed by this report:

```sh
node scripts/accounting-recovery.mjs reobserve /workspaces/.poxey-state/attempt3-recovery-20261015 /workspaces/.poxey-state/attempt3
```

This copies ledger bytes unchanged, leaves the old directory/manifest/gate intact,
creates no key, and starts a **new full 24-hour same-boot waiting interval**.
It cannot shorten the old deadline, activate access, or change startup configuration.
Keep admission closed on all relevant hosts throughout. Rebooting again requires
another review; do not bypass it by editing manifests or clocks. Automatic recovery
on startup is intentionally not provided.

After the new interval and independent safety review, use the existing activation
command on that new directory, then explicitly configure `POXEY_STATE_DIR` for
the intended service account to the ready directory. Store configuration privately
and persistently; verify it survives restart. Do not change that configuration
before reviewing which Codespace is authoritative. The normal `npm run dev`
command is unchanged, and remains blocked until ready state is selected.

Do not edit the gate or manifest to bypass it: preserve the state and perform a
reviewed new observation/recovery into a separate empty destination, with a new
full waiting interval and explicit configuration. Preparation will not overwrite
partial state. An interruption after the pinned key is durable can resume with
the exact same key and original gate. An interruption before key creation remains
blocked and requires reviewed recovery; it never manufactures another key.

Invalid/duplicate/malformed cookies get HTTP 401 on session creation, not a fresh
identity. After an approved rotation, returning browsers with old signatures
will therefore need to remove **only the obsolete Poxey identity cookie**, after
the gate and with informed user action. No automatic cookie clearing was added.
Cookie deletion, another browser/profile/device and absent cookies can still
obtain distinct identities: this is not an absolute per-person limit. A separately
approved account-bound beta policy is needed before claiming one.

## Persistence, backups and failure recovery

`/workspaces` is Codespaces' persistent workspace storage, not `/tmp`; the existing
recovery archive survived the observed environment restart. This does **not**
protect against Codespace deletion or provider storage loss. Keep protected
off-host backups of the complete state set through an approved private mechanism.
No backup upload or new cloud service is activated by this change.

Before backing up ready state, stop the manager gracefully and verify no sessions
remain. Copy the complete directory (ledger + key + manifest) to a new protected
location; preserve ownership/modes and check hashes without displaying contents.
Do not back up one file while accounting writes are in progress. Never overwrite
the only intact backup. Never restore an older ledger over newer consumption.

Ledger writes are atomic, fsynced and monotonic within each window. They cannot
delete a prior identity or reduce its consumed time. A crash between the durable
ledger write and its checksum update intentionally blocks admission; the newer
consumption remains on disk. Preserve both files and inspect the ambiguous
transaction before any repair. There is deliberately no automatic rollback,
checksum repair or empty-ledger fallback. Accounting cannot recover unknown
unflushed usage after abrupt process/host loss; reviewed recovery must preserve
known consumption and protect any uncertain allowance windows.

These filesystem checks protect against accidental loss/corruption, not malicious
code running as the same OS user or root. Production per-session container/network
isolation remains a release blocker. Do not expose the Codespace publicly.

## Safe regression testing

`npm run test:accounting` uses disposable, synthetic state outside Git. It covers
missing/corrupt state, permissions, signatures, restart persistence, monotonic
usage, expiry boundaries and injected interrupted writes. It never uses the
surviving ledger. Live capacity/cold-audio diagnostics now additionally require
an explicitly provisioned disposable `POXEY_STATE_DIR`; do not point them at
`/workspaces/.poxey-state/attempt3` or run them during recovery.
