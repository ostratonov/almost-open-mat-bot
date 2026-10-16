import sharp from 'sharp';
import { brightShare, pickColors } from './colors.ts';
import { layoutCaption } from './layout.ts';
import { captionSvg } from './svg.ts';

const MAX_SIDE = 2560;
const MAX_INPUT_PIXELS = 60_000_000;

export async function addCaption(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  const layout = layoutCaption(info);
  const colors = pickColors(await brightShare(pixels(), layout));

  return pixels()
    .composite([{ input: Buffer.from(captionSvg(info, layout, colors)) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
