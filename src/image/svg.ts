import type { CaptionLayout, Size, TextColors } from './image.types.ts';

export function captionSvg({ width, height }: Size, { size, path }: CaptionLayout, colors: TextColors): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <filter id="halo" x="-10%" y="-30%" width="120%" height="160%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="${size * 0.02}" result="grown"/>
    <feGaussianBlur in="grown" stdDeviation="${size * 0.03}" result="soft"/>
    <feFlood flood-color="${colors.shadow}" flood-opacity="0.6"/>
    <feComposite in2="soft" operator="in" result="glow"/>
    <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <path d="${path}" fill="${colors.fill}" filter="url(#halo)"/>
</svg>`;
}

export function maskSvg({ path, box }: CaptionLayout): string {
  return `<svg width="${box.width}" height="${box.height}" xmlns="http://www.w3.org/2000/svg">
  <path d="${path}" transform="translate(${-box.left} ${-box.top})"/>
</svg>`;
}
