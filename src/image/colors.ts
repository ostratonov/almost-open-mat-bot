import sharp, { type Sharp } from 'sharp';
import type { CaptionLayout, TextColors } from './image.types.ts';
import { maskSvg } from './svg.ts';

const BRIGHT_LUMA = 170;
const BLACK_TEXT_FROM_BRIGHT_SHARE = 0.5;

export async function brightShare(image: Sharp, layout: CaptionLayout): Promise<number> {
  const background = await image.extract(layout.box).removeAlpha().greyscale().raw().toBuffer();
  const mask = await sharp(Buffer.from(maskSvg(layout))).ensureAlpha().extractChannel(3).raw().toBuffer();

  let covered = 0;
  let bright = 0;
  for (let i = 0; i < mask.length; i++) {
    covered += mask[i];
    if (background[i] > BRIGHT_LUMA) bright += mask[i];
  }
  return covered ? bright / covered : 0;
}

export function pickColors(brightShare: number): TextColors {
  return brightShare > BLACK_TEXT_FROM_BRIGHT_SHARE
    ? { fill: 'black', shadow: 'white' }
    : { fill: 'white', shadow: 'black' };
}
