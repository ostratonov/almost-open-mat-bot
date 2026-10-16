import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { addCaption } from './caption.ts';

test('draws the caption at the bottom and keeps the size', async () => {
  const grey = { r: 128, g: 128, b: 128 };
  const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: grey } }).png().toBuffer();

  const out = sharp(await addCaption(input));
  assert.deepEqual(await out.metadata().then(({ width, height }) => ({ width, height })), { width: 800, height: 600 });

  const { data } = await out.clone().raw().toBuffer({ resolveWithObject: true });
  const rowHasInk = (y: number) => {
    for (let x = 0; x < 800; x++) if (Math.abs(data[(y * 800 + x) * 3] - 128) > 60) return true;
    return false;
  };
  assert.ok(!rowHasInk(50), 'top should be untouched');
  assert.ok([...Array(150).keys()].some((i) => rowHasInk(450 + i)), 'bottom should have text');
});
