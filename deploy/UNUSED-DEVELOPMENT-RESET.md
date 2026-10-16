# Explicit reset for the owner's unused development deployment

The owner explicitly approved resetting allowances for the friend's unused
Codespace after confirming nobody uses the site. This is **not** the
allowance-preserving recovery procedure. It intentionally invalidates old browser
cookies and gives newly issued browser identities a fresh allowance. Do not use
it on a deployment with real users or outstanding allowances that must survive.

The tool is refused in production and requires the literal confirmation below,
an idle Linux host, private persistent state paths and no environment secret
override. It never runs automatically from `npm run dev`.

In the friend's Codespace terminal, stop Poxey normally first, then:

```sh
cd /workspaces/attempt3
git fetch origin fix/accounting-reboot-recovery
git merge --ff-only origin/fix/accounting-reboot-recovery
npm run accounting:reset-unused-dev -- RESET-UNUSED-DEVELOPMENT-ALLOWANCES
npm run accounting:status
npm run dev
```

Stop if any command fails. Do not discard local modifications to make the Git
update pass. The reset command selects the same configured persistent directory
as startup; normal everyday startup remains `npm run dev` afterward.

Before changing the selected directory, the tool stages and validates a fresh
private ready state. If old state exists, the entire original directory is moved
to a unique adjacent `.owner-backup-UUID` directory, preserving its contents
verbatim. No backup is deleted or overwritten. The replacement uses a random
256-bit signing key and an empty ledger, with directories mode 0700 and files
0600. Keys and ledger contents are never printed or committed. Session-token,
VNC and audio authentication remain unchanged; the ordinary 25-minute policy
still applies to new identities.

If interrupted after backing up but before publishing, normal startup remains
blocked. Preserve the backup and private `.owner-reset-*` staging directory for
operator review; do not retry blindly or delete either directory. The CLI prints
the backup location on successful completion.

## Verification and limits

281 Mac backend tests pass (including all 60 focused accounting tests and eight owner-reset cases) for
explicit consent, production/idle/boot refusals, private persistent state,
byte-exact backup (including damaged data), interrupted publication and unsafe
permissions. Existing missing-state fail-closed and allowance-preserving recovery
tests still pass. This reset has **not** been run against the owner's protected
original state or the inaccessible friend's Codespace. Linux execution and real
Chrome/audio startup in the friend's environment remain unverified. This tool
does not install missing Linux dependencies or prove production readiness.
