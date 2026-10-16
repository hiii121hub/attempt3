# noVNC source and local modification

Bundled source matches noVNC v1.3.0, upstream commit
`463c39e4af98ec4106b87bbea17e1605aa4c6180`, except `core/util/element.js`.
That file retains Poxey's existing canvas-coordinate scaling/clipping change
(Poxey commit `32996a1`), under MPL-2.0. No vendored code changed in this review.

Original upstream: https://github.com/novnc/noVNC/tree/463c39e4af98ec4106b87bbea17e1605aa4c6180

Exact bundled source, including the local modification and separate notices:
https://github.com/hiii121hub/attempt3/tree/c9a2bd82b914b0f421aa95c40fcac21648a6e15b/frontend/public

Source is also served as unminified modules under `/core/` and `/vendor/pako/`.
The historical duplicate module layout remains preserved. The repository's
`deploy/novnc-provenance.json` records file hashes and upstream paths.

noVNC core and its modifications retain MPL-2.0; pako retains its separate MIT
notice; DES retains its embedded individual terms. See `LICENSE.txt`,
`licenses/MPL-2.0.txt` and `vendor/pako/LICENSE`. Poxey's MIT grant does not
replace these terms. Redistributors must retain notices and provide corresponding
covered source for their actual version, including subsequent changes.
