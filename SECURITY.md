# Security status and reporting

Engineering preview; no approved public multi-user release or response SLA.

Use GitHub private vulnerability reporting if enabled. Otherwise ask the
maintainer for a private channel before sharing exploit details. Never put
secrets, tokens, cookies, profiles, usage or browsing data in public issues.
This cleanup does not configure private reporting or invent a contact address.

## Known limitations

- Native sessions share a UID, network and PulseAudio server. Separate profiles/
  sinks are not full security boundaries. Offline Podman work is not integrated.
- Development retains existing Chrome flags; production omits `--no-sandbox`.
  Actual Linux sandbox/container enforcement remains an acceptance gate.
- The limit is per signed browser identity, not per person. Cookie deletion and
  another browser can create new identities.
- Missing or ambiguous accounting fails closed. Never edit recovery gates, create
  empty state or restore older consumption over newer records.
- Token query strings and diagnostics may disclose credentials or destinations.
  Redact query tokens, Cookie and Authorization in all logs/proxies.
- Development dependencies have advisories. Do not expose Vite, Vitest UI,
  debugging, VNC, PulseAudio or backend ports publicly.
- Old shared-browser/audio entrypoints are disabled; source/backups remain history.

See [recovery](deploy/IDENTITY-RECOVERY.md),
[threat model](deploy/ALLOWANCE-THREAT-MODEL.md) and
[acceptance](deploy/SERVER-ACCEPTANCE.md).
Dependency/pattern scans cannot prove absence of vulnerabilities or secrets.
