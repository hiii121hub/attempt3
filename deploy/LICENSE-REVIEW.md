# MIT scope and provenance review — October 14, 2026

The owner explicitly authorized MIT for Poxey code they own, using
`Copyright (c) 2026 hiii121hub`. The root [LICENSE](../LICENSE) contains the
standard MIT grant. No third-party copyright or license was replaced.

## Scope

MIT covers original Poxey code to the extent hiii121hub owns the rights.
It does not claim ownership of other contributors' work, vendored libraries,
installed dependencies, Chrome, operating-system packages, logos, images,
branding or trademarks. Excluded material retains its own applicable terms.
Unverified material is not newly licensed by this grant.

## Evidence reviewed and remaining permissions

| Material | Evidence | Status |
|---|---|---|
| Poxey-owned code | Explicit owner approval | MIT grant added |
| Contributions under other Git author identities | Multiple author identities in reachable history | Identities do not establish ownership or a contributor license; confirm rights before blanket redistribution |
| noVNC core and duplicate historical layout | MPL headers; complete MPL text and source shipped | Separate MPL terms retained; exact bundled upstream revision/local-change provenance still unestablished |
| pako ES-module fork | README identifies 1.0.3; separate MIT notice | Retained under its own notice, not hiii121hub's copyright |
| DES portions | Individual AT&T/Widget Workshop/Jef Poskanzer notices in source | Retain all individual terms; not replaced with project MIT |
| `frontend/public/logo.png` | Added in `7565d31`, described as official Poxey logo | Active UI asset; no creation/source permission document located; excluded from MIT grant pending confirmation |
| `frontend/public/IMG_4115_3.PNG` | Added in `234babf`; actually SVG despite filename, used by historical root app | No creation/source permission document located; excluded pending confirmation |
| Google Chrome | Installed separately, not vendored here | No Chrome redistribution rights asserted |

No asset, UI, third-party source, backup or user data was removed or changed.
A Git author, filename or commit description is not proof of a legal right.
The images remain preserved for the existing UI, but this review cannot certify
their inclusion for redistribution. Obtain owner/source evidence or permission
before claiming a completely cleared distributable.

## Dependency inventory

Reviewed 407 dependency entries in the existing lockfile against available
installed package metadata. The 29 third-party production entries declare MIT,
BSD-2-Clause or ISC. Two additional production entries are local workspace links,
not independent third-party packages. No installed external package lacked a
license declaration in this check; metadata is not a complete terms audit.

Development/optional packages also include Apache-2.0, BlueOak, LGPL, CC-BY-4.0,
CC0 and other permissive expressions. In particular, sharp/libvips packages have
LGPL-containing declarations and caniuse-lite declares CC-BY-4.0. Do not bundle
development tools/binaries or dependency data assuming the project MIT grant
covers them. Retain each distributed dependency's notices and comply with its
terms. This change does not rebuild a dependency distribution or certify it.

## Terms-page clarification still needed

`frontend/src/TermsPage.tsx`, section 16, broadly describes proprietary materials
and copying/modification restrictions. MIT is the owner's explicit permission for
covered code; service-access rules, branding and excluded materials are separate.
The wording should be reviewed and clarified before public release so recipients
are not misled about source-code rights. It was not changed here because UI/text
changes were outside this licensing update's preservation scope.

## Before unrestricted redistribution

1. Confirm rights for contributions under other author identities (they may be
   the owner's accounts, but Git metadata alone cannot establish that).
2. Supply ownership/source/permission evidence for both images; separately decide
   whether to license assets or reserve branding.
3. Establish vendored revisions/local modifications and check all third-party
   source/notice obligations for the exact packaged release.
4. Clarify the terms page and retain all dependency notices in any distributable.

This is an engineering provenance review, not a legal opinion or a guarantee
that all repository contents can be redistributed.

## Verification of this update

On macOS with Node 26.8.2/npm 11.19.1, all 324 offline tests passed
(255 backend, 28 frontend, 41 worker), with zero failed/skipped. Both builds and
diff checks passed. Frontend bundle names remain unchanged. The new regression
checks the exact copyright, scoped grant and unchanged separate pako copyright.
No UI/runtime, lockfile, real-user state or recovery safeguard was changed.

References: [MIT terms](https://opensource.org/license/mit),
[Mozilla distribution guidance](https://www.mozilla.org/en-US/MPL/2.0/FAQ/),
and [third-party notices](../THIRD_PARTY_NOTICES.md).
