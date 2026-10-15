# Third-party notices and licensing review

The owner approved MIT for Poxey code they own: see [LICENSE](LICENSE),
Copyright (c) 2026 hiii121hub. This does not relicense the third-party portions
below or grant rights to logos, images or trademarks. The owner confirmed that
all contributing GitHub accounts belong to them and that their original
contributions are theirs; that statement does not relicense imported code.
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
The subsequent source comparison identifies noVNC v1.3.0 commit
`463c39e4af98ec4106b87bbea17e1605aa4c6180`: 75 of 76 bundled files match
byte-for-byte, including pako and the historical duplicate layout. Only
`frontend/public/core/util/element.js` differs: Poxey's canvas-coordinate scaling
and clipping fix from `32996a1`, retained under MPL-2.0. See the
[hash manifest](deploy/novnc-provenance.json) and
[source availability notice](frontend/public/SOURCE.noVNC.md).
This establishes a content match, not the original downloader's history.
No vendor code or embedded individual attribution was changed.

## Other components

npm dependencies retain their own licenses; inspect the installed packages and
lockfile when preparing a distributable. Chrome is separately installed proprietary
software; no redistribution entitlement is implied. Linux tools and fonts have
separate package licenses. The provenance/permission for bundled logos/images
has not been established. Review these before reuse or release.

This inventory is not a legal clearance or a complete license audit.
