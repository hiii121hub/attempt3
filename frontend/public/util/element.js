/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2020 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 */

/*
 * HTML element utility functions
 */

export function clientToElement(x, y, elem) {
    const bounds = elem.getBoundingClientRect();

    // Convert from the element's visual/CSS coordinates back to
    // its actual canvas coordinate system. This is important when
    // a parent element uses CSS transform: scale(...).
    const scaleX = elem.width > 0 && bounds.width > 0
        ? elem.width / bounds.width
        : 1;

    const scaleY = elem.height > 0 && bounds.height > 0
        ? elem.height / bounds.height
        : 1;

    let pos = { x: 0, y: 0 };

    // Clip to target bounds, then compensate for CSS scaling.
    if (x < bounds.left) {
        pos.x = 0;
    } else if (x >= bounds.right) {
        pos.x = elem.width - 1;
    } else {
        pos.x = (x - bounds.left) * scaleX;
    }

    if (y < bounds.top) {
        pos.y = 0;
    } else if (y >= bounds.bottom) {
        pos.y = elem.height - 1;
    } else {
        pos.y = (y - bounds.top) * scaleY;
    }

    return pos;
}
