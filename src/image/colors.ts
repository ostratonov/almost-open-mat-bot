import sharp from 'sharp';
import type { Box, TextColors } from './image.types.ts';

const BLACK_TEXT_FROM_LUMA = 165;

export async function meanLuma(image: Buffer, box: Box): Promise<number> {
  const stats = await sharp(image).extract(box).greyscale().stats();
  return stats.channels[0].mean;
}

export function pickColors(luma: number): TextColors {
  return luma > BLACK_TEXT_FROM_LUMA ? { fill: 'black', shadow: 'white' } : { fill: 'white', shadow: 'black' };
}
