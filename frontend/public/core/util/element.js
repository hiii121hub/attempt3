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
 //   C SS scale (or any other layout scaling).
   const scaleX = elem.width / bounds.width;
    const scaleY = elem.height / bounds.height;

   const xInCanvas = (x - bounds.left) * scaleX;
  const yInCanvas = (y - bounds.top) * scaleY;

 return {
       x:  Math.max(0, Math.min(elem.width - 1, xInCanvas)),
      y : Math.max(0, Math.min(elem.height - 1, yInCanvas)),
 }   ;
}
