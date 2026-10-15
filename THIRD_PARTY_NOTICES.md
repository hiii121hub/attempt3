# Third-party notices and licensing review

The owner approved MIT for Poxey code they own: see [LICENSE](LICENSE),
Copyright (c) 2026 hiii121hub. This does not relicense the third-party portions
below or grant rights to unverified contributions, logos, images or trademarks.
See [the provenance review](deploy/LICENSE-REVIEW.md) for remaining blockers.

## Bundled browser code

- noVNC core in `frontend/public/core/` and historical copies in `public/`:
  MPL-2.0, as stated in their source headers. Full text is shipped at
  `frontend/public/licenses/MPL-2.0.txt`, with a public `LICENSE.txt` pointer.
- ES-module pako fork in `frontend/public/vendor/pako/`: its README identifies
  pako 1.0.3. MIT text is restored at `vendor/pako/LICENSE`.
- DES and other individually attributed portions retain their source notices;
  do not remove those headers or assume all vendored files use one license.

License texts were copied unchanged from official noVNC v1.3.0
[Mozilla license text](https://github.com/novnc/noVNC/blob/v1.3.0/docs/LICENSE.MPL-2.0)
and [pako notice](https://github.com/novnc/noVNC/blob/v1.3.0/vendor/pako/LICENSE).
This identifies the license-text source, **not** a verified version/provenance
claim for every bundled code file. The vendored noVNC revision is not recorded.
Before redistribution, establish exact upstream revisions/local changes and
review source availability/notice obligations. No vendor code is changed here.

## Other components

npm dependencies retain their own licenses; inspect the installed packages and
lockfile when preparing a distributable. Chrome is separately installed proprietary
software; no redistribution entitlement is implied. Linux tools and fonts have
separate package licenses. The provenance/permission for bundled logos/images
has not been established. Review these before reuse or release.

This inventory is not a legal clearance or a complete license audit.
