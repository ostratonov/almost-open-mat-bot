import type { CaptionLayout, Size, TextColors } from './image.types.ts';

export function captionSvg({ width, height }: Size, { size, path }: CaptionLayout, colors: TextColors): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <filter id="s" x="-10%" y="-30%" width="120%" height="160%">
    <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.04}" flood-color="${colors.shadow}" flood-opacity="0.45"/>
  </filter>
  <path d="${path}" fill="${colors.fill}" filter="url(#s)"/>
</svg>`;
}
