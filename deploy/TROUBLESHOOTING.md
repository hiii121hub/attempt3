# Troubleshooting safely

## Identity/accounting refusal

Intentional fail-closed behavior. Keep stopped/private and read
[recovery](IDENTITY-RECOVERY.md). Preserve state/backups without printing contents.
Never create an empty ledger, clear cookies for more time, or edit the gate.
Reboot during a waiting interval invalidates same-boot proof; reviewed recovery
is required, not a changed deadline.

## Ports, startup and capacity

Use `npm run dev` from the intended checkout on Linux only after accounting is ready.
Frontend: 3999. Manager: loopback 3997. Identify owner/revision before stopping any
process. Keep forwarded ports private; never use broad Chrome/VNC kills.
Root Vite config and legacy shared-browser commands are not startup alternatives.

Inspect redacted diagnostics/private health. Slots include starting, active and
retiring sessions. Existing bounded retries handle temporary busy responses,
not identity failures. Do not raise production capacity to hide resource errors.
Session termination/refresh must retain allowance consumption.

## Audio/input

Check Linux dependencies, `pactl info`, session-specific sink, owned FFmpeg and
authenticated WebSockets. Never start the disabled historical global audio relay
or hardcode a temporary Pulse socket. Redact browser-console/network credentials.
Actual sound, touch, scroll and Safari need real client testing; test passes or
PCM bytes alone do not prove them. Do not change CSS/sizes as a workaround.

## Tests and builds

Root `npm test` runs once; workspace test commands alone watch.
Tests need writable system temporary storage and workspace parent for synthetic
accounting fixtures. Restricted environments may need permission for those paths
or an approved `TMPDIR`; never relax real-state permissions.

Worker build uses `noEmit`. Wrangler reads TS directly. Do not restore generated
JS siblings. Its JS-only `index.test.js` is intentional.
The Worker is a retained HTTP prototype, not the real-Chrome backend.

## Public hosting

No verified permanent free/no-card host or five-active-viewer capacity exists.
Complete [acceptance](SERVER-ACCEPTANCE.md) and actual isolation first.
Never expose development servers or disable authentication/sandboxing for tests.
