import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { MediaGroupCollector } from './media-group.ts';

test('an album is handed over once, after its last photo goes quiet', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const ready: string[][] = [];
  const albums = new MediaGroupCollector<string>(1000, (items) => ready.push(items));

  albums.add('a', '1');
  mock.timers.tick(600);
  albums.add('a', '2');
  albums.add('b', 'x');
  mock.timers.tick(600);
  assert.deepEqual(ready, [], 'still waiting for more of "a"');
  assert.ok(albums.has('a'));

  mock.timers.tick(400);
  assert.deepEqual(ready, [['1', '2'], ['x']]);
  assert.ok(!albums.has('a'));
  mock.timers.reset();
});
