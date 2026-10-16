import sharp from 'sharp';

export const CAPTION = 'almost open mat';

export async function addCaption(input: Buffer): Promise<Buffer> {
  // rotate() with no angle applies EXIF orientation, so the text lands on the bottom the viewer sees
  const { data, info } = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const fontSize = Math.round(Math.min(width * 0.11, height * 0.15));

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="${height - fontSize * 0.5}" text-anchor="middle"
    font-family="Impact, Anton, 'Arial Black', sans-serif" font-size="${fontSize}"
    fill="white" stroke="black" stroke-width="${fontSize / 12}" paint-order="stroke">${CAPTION}</text>
</svg>`;

  return sharp(data)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
