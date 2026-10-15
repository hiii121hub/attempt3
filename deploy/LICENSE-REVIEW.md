# MIT scope and provenance review — October 14, 2026

The owner explicitly authorized MIT for Poxey code they own, using
`Copyright (c) 2026 hiii121hub`. The root [LICENSE](../LICENSE) contains the
standard MIT grant. No third-party copyright or license was replaced.

## Scope

MIT covers original Poxey code to the extent hiii121hub owns the rights.
The owner subsequently confirmed all other contributing GitHub accounts belong
to them and confirmed ownership of their original contributions. This is recorded
as an owner attestation, not independent legal proof. It does not cover imported
material or override MPL on modifications within covered files.

It does not claim ownership of third-party work, vendored libraries,
installed dependencies, Chrome, operating-system packages, logos, images,
branding or trademarks. Excluded material retains its own applicable terms.
Unverified material is not newly licensed by this grant.

## Evidence reviewed and remaining permissions

| Material | Evidence | Status |
|---|---|---|
| Poxey-owned code | Explicit owner approval | MIT grant added |
| Original contributions under other Git author identities | Owner explicitly confirms all contributing accounts belong to them and ownership of original contributions | Ownership confirmation recorded; imported third-party work remains excluded |
| noVNC core and duplicate historical layout | Official v1.3.0 commit content comparison and SHA-256 manifest | 75/76 files identical; one documented Poxey coordinate modification retains MPL; source notice added |
| pako ES-module fork | README identifies 1.0.3; separate MIT notice | Retained under its own notice, not hiii121hub's copyright |
| DES portions | Individual AT&T/Widget Workshop/Jef Poskanzer notices in source | Retain all individual terms; not replaced with project MIT |
| `frontend/public/logo.png` | Added in `7565d31`; owner confirms they made it | Creator attestation recorded; retained as branding outside the MIT code grant |
| `frontend/public/IMG_4115_3.PNG` | Added in `234babf`; actually SVG; owner confirms they made it | Creator attestation recorded; retained outside the MIT code grant |
| Google Chrome | Installed separately, not vendored here | No Chrome redistribution rights asserted |

No asset, styling, third-party source, backup or user data was removed or changed.
A Git author, filename or commit description is not proof of a legal right.
The images remain preserved for the existing UI based on the owner's creator
attestation. This is not independent legal clearance of third-party input rights,
copyright eligibility or trademarks. No standalone reusable asset license is
granted by this code-licensing change.

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

## Additional image investigation

Reviewed both asset introduction commits, the PNG visually and its metadata,
and the complete SVG source. The SVG is self-contained geometry, gradients and
system-font text, with no embedded external image/font or creator/license notice.
The active PNG contains a caBX/JUMBF metadata block claiming OpenAI Media Service
and gpt-image generation with algorithmic-media attribution. Its cryptographic
signature was not validated. Neither visual appearance nor embedded claims prove
the generating account, permission for uploaded source materials, copyright
ownership or freedom from trademark claims. No image was modified or removed.

The owner subsequently answered "I made them" for both images. Record this as
their creator attestation, not independent proof of the generation account or
any input-material rights. No third-party input source was identified or ruled
out by that answer. Images and branding are excluded from the MIT code grant;
downstream reuse needs separate permission. No broader asset license is chosen.

## Verified noVNC content provenance

Compared 31 active core modules, 31 preserved duplicate modules and 14 pako
files/notices against official noVNC v1.3.0 commit
`463c39e4af98ec4106b87bbea17e1605aa4c6180`. 75 files match byte-for-byte.
Only `core/util/element.js` differs; Git history identifies `32996a1` as the
coordinate scaling/clipping change. It remains MPL-covered and unchanged.
The [76-file manifest](novnc-provenance.json) pins local/upstream SHA-256 hashes
and paths. The public [source notice](../frontend/public/SOURCE.noVNC.md) links
the exact bundled source and tells redistributors to supply corresponding source
for their own version. This is content provenance, not proof of download history.

## Approved Terms-page clarification applied

`frontend/src/TermsPage.tsx`, section 16, broadly describes proprietary materials
and copying/modification restrictions. MIT is the owner's explicit permission for
covered code; service-access rules, branding and excluded materials are separate.
The owner explicitly approved the wording-only change. Section 16's restrictive
paragraph is now replaced with:

> Poxey-owned source code is available under the MIT License. Third-party code,
> including modifications to MPL-covered files, remains under its applicable
> licenses. These Terms do not restrict rights granted by those licenses.
> Branding, logos and other excluded materials are not licensed by the source-code
> license; use requires permission unless applicable law allows otherwise.

This preserves service-access rules while separating them from source-code rights.
Only that paragraph and its last-updated date changed. Styling, markup structure,
Chrome/input/audio/session behavior and the current homepage modal are untouched.
This standalone TermsPage component is not imported by the current frontend
entrypoint: the approved wording is updated in source but is not a newly exposed
page/route. No new routing or interface was introduced.

## Before unrestricted redistribution

1. Owner confirmation of original contributions is now recorded; do not extend
   it to imported third-party material.
2. Image creator attestation is recorded. Keep assets/branding reserved unless
   separately licensed; establish input rights and trademark clearance if needed
   for a downstream distribution rather than assuming MIT covers them.
3. Content-match provenance is now pinned; retain the manifest, notices and
   corresponding covered source for the exact version being redistributed.
4. The approved Terms clarification is applied to the stored component. Review
   actual served terms in any release and retain all dependency notices.

This is an engineering provenance review, not a legal opinion or a guarantee
that all repository contents can be redistributed.

## Verification of the initial MIT addition

On macOS with Node 26.8.2/npm 11.19.1, all 324 offline tests passed
(255 backend, 28 frontend, 41 worker), with zero failed/skipped. Both builds and
diff checks passed. Frontend bundle names remain unchanged. The new regression
checks the exact copyright, scoped grant and unchanged separate pako copyright.
No UI/runtime, lockfile, real-user state or recovery safeguard was changed.

References: [MIT terms](https://opensource.org/license/mit),
[Mozilla distribution guidance](https://www.mozilla.org/en-US/MPL/2.0/FAQ/),
and [third-party notices](../THIRD_PARTY_NOTICES.md).

### Ownership/provenance follow-up verification

The subsequent owner-attestation and noVNC review passed all 326 offline tests
(257 backend, 28 frontend, 41 worker), zero failed/skipped, plus both builds and
diff checks. Two new checks verify every recorded vendor hash and the distinction
between ownership confirmation, excluded assets and approved Terms license rights.
Source comparison used a separate official upstream checkout; no upstream code
was executed. Existing vendor, image, styling, runtime and accounting files were
not modified. The subsequent owner-approved Terms paragraph/date update also
passed all 326 tests and both builds, zero failures/skips. Frontend bundle names
remain unchanged because the standalone Terms component is not wired to the app;
no route or visible modal was changed.
