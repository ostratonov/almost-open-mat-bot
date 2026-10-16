import sharp from 'sharp';
import { meanLuma, pickColors } from './colors.ts';
import { layoutCaption } from './layout.ts';
import { captionSvg } from './svg.ts';

export async function addCaption(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const layout = layoutCaption(info);
  const colors = pickColors(await meanLuma(data, layout.box));

  return sharp(data)
    .composite([{ input: Buffer.from(captionSvg(info, layout, colors)) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
