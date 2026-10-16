import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RateLimiter } from './rate-limiter.ts';

test('three per minute per user, then the window slides', () => {
  const limiter = new RateLimiter(3, 60_000);
  assert.ok(limiter.tryTake(1, 0));
  assert.ok(limiter.tryTake(1, 10_000));
  assert.ok(limiter.tryTake(1, 20_000));
  assert.ok(!limiter.tryTake(1, 30_000));
  assert.ok(limiter.tryTake(2, 30_000), 'another user is not affected');
  assert.ok(limiter.tryTake(1, 60_000), 'the first hit left the window');
  assert.ok(!limiter.tryTake(1, 60_001));
});
