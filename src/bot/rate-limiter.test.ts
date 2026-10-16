import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RateLimiter } from './rate-limiter.ts';

test('three per minute per user, then the window slides', () => {
  const limiter = new RateLimiter(3, 60_000);
  assert.ok(limiter.tryTake(1, 1, 0));
  assert.ok(limiter.tryTake(1, 1, 10_000));
  assert.ok(limiter.tryTake(1, 1, 20_000));
  assert.ok(!limiter.tryTake(1, 1, 30_000));
  assert.ok(limiter.tryTake(2, 1, 30_000), 'another user is not affected');
  assert.ok(limiter.tryTake(1, 1, 60_000), 'the first hit left the window');
  assert.ok(!limiter.tryTake(1, 1, 60_001));
});

test('an album takes as many slots as it has photos, or none', () => {
  const limiter = new RateLimiter(20, 60_000);
  assert.ok(limiter.tryTake(1, 10, 0));
  assert.ok(limiter.tryTake(1, 8, 1));
  assert.ok(!limiter.tryTake(1, 3, 2), 'would make 21');
  assert.ok(limiter.tryTake(1, 2, 3), 'the refused album took nothing');
});
