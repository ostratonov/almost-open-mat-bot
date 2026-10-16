import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { addCaption } from './caption.ts';

async function captionOn(grey: number) {
  const input = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: grey, g: grey, b: grey } },
  })
    .png()
    .toBuffer();
  const out = sharp(await addCaption(input));
  const { width, height } = await out.metadata();
  assert.deepEqual({ width, height }, { width: 800, height: 600 });

  const { data } = await out.raw().toBuffer({ resolveWithObject: true });
  const extremeIn = (fromY: number, toY: number) => {
    let min = 255;
    let max = 0;
    for (let i = fromY * 800 * 3; i < toY * 800 * 3; i += 3) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
    }
    return { min, max };
  };
  return { top: extremeIn(0, 300), bottom: extremeIn(450, 600) };
}

test('white text on a dark picture, at the bottom only', async () => {
  const { top, bottom } = await captionOn(60);
  assert.ok(top.max < 80, 'top should be untouched');
  assert.ok(bottom.max > 240, 'bottom should have white text');
});

test('a huge file comes back no larger than a Telegram photo', async () => {
  const input = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: 'grey' } })
    .jpeg()
    .toBuffer();
  const { width, height } = await sharp(await addCaption(input)).metadata();
  assert.deepEqual({ width, height }, { width: 2560, height: 1920 });
});

test('black text on a bright picture', async () => {
  const { bottom } = await captionOn(235);
  assert.ok(bottom.min < 20, 'bottom should have black text');
});
