import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampBox, layoutCaption } from './layout.ts';

test('caption sits centred near the bottom of a photo', () => {
  const { box } = layoutCaption({ width: 600, height: 800 });
  assert.ok(Math.abs(box.left + box.width / 2 - 300) < 2, 'centred');
  assert.ok(Math.abs(box.width - 480) < 2, '80% wide');
  assert.ok(Math.abs(box.top + box.height - 752) < 2, '6% above the bottom');
});

test('a panorama caps the text height instead of the width', () => {
  const { box } = layoutCaption({ width: 4000, height: 500 });
  assert.ok(box.height <= 61, `height ${box.height} over 12%`);
  assert.ok(box.width < 3200);
});

test('clampBox keeps the box inside the image', () => {
  assert.deepEqual(clampBox({ left: -5, top: 90, width: 50, height: 20 }, { width: 40, height: 100 }), {
    left: 0,
    top: 90,
    width: 40,
    height: 10,
  });
});
