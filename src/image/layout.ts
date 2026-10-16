import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
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
    path: font.getPath(CAPTION, x, baseline, size).toPathData(2),
    box: clampBox(box, { width, height }),
  };
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
