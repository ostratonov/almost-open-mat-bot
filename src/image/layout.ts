import { readFileSync } from 'node:fs';
import opentype, { type PathCommand } from 'opentype.js';
import type { Box, CaptionLayout, Size } from './image.types.ts';

export const CAPTION = 'almost open mat';

const TEXT_WIDTH = 0.8;
const MAX_TEXT_HEIGHT = 0.12;
const BOTTOM_MARGIN = 0.06;

const font = opentype.parse(
  new Uint8Array(readFileSync(new URL('../../assets/LobsterTwo-BoldItalic.ttf', import.meta.url))).buffer,
);
const unit = font.getPath(CAPTION, 0, 0, 1).getBoundingBox();
const unitWidth = unit.x2 - unit.x1;
const unitHeight = unit.y2 - unit.y1;

export function layoutCaption({ width, height }: Size): CaptionLayout {
  const size = Math.min((width * TEXT_WIDTH) / unitWidth, (height * MAX_TEXT_HEIGHT) / unitHeight);
  const x = (width - unitWidth * size) / 2 - unit.x1 * size;
  const baseline = height * (1 - BOTTOM_MARGIN) - unit.y2 * size;

  const box = {
    left: Math.floor(x + unit.x1 * size),
    top: Math.floor(baseline + unit.y1 * size),
    width: Math.ceil(unitWidth * size),
    height: Math.ceil(unitHeight * size),
  };

  return {
    size,
    path: toPathData(font.getPath(CAPTION, x, baseline, size).commands),
    box: clampBox(box, { width, height }),
  };
}

// opentype's own toPathData writes NaN for coordinates a hair off an integer (it rounds via "1e-7" + "e+2").
export function toPathData(commands: PathCommand[]): string {
  const n = (v: number) => v.toFixed(2);
  return commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case 'Z':
          return 'Z';
      }
    })
    .join('');
}

export function clampBox(box: Box, bounds: Size): Box {
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  return {
    left,
    top,
    width: Math.min(bounds.width - left, box.width),
    height: Math.min(bounds.height - top, box.height),
  };
}
