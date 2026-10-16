import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StatsStore } from './stats.store.ts';
import { StatEvent } from './stats.types.ts';

const DAY = 24 * 60 * 60_000;

test('counts the period, splits out groups, and ranks people', () => {
  const stats = new StatsStore(':memory:');
  const now = 100 * DAY;
  stats.record(StatEvent.Picture, 1, '@old', 1, 1, now - 8 * DAY);
  stats.record(StatEvent.Picture, 1, '@sasha', 1, 3, now - DAY);
  stats.record(StatEvent.Suggestion, 1, '@sasha', 1, 1, now - DAY);
  stats.record(StatEvent.Picture, 2, 'Оля', -100, 4, now - DAY);
  stats.record(StatEvent.Picture, 3, '@quiet', 3, 1, now - DAY);

  const week = stats.since(now - 7 * DAY);
  assert.equal(week.pictures, 8);
  assert.equal(week.groupPictures, 4);
  assert.equal(week.suggestions, 1);
  assert.equal(week.people, 3);
  assert.deepEqual(
    week.top.map(({ name, pictures, suggestions }) => [name, pictures, suggestions]),
    [
      ['Оля', 4, 0],
      ['@sasha', 3, 1],
      ['@quiet', 1, 0],
    ],
    'a tie on pictures plus suggestions goes to more pictures; the latest name wins; last week is left out',
  );
  stats.close();
});

test('an empty period is zeros, not nulls', () => {
  const stats = new StatsStore(':memory:');
  assert.deepEqual(stats.since(0), { pictures: 0, groupPictures: 0, suggestions: 0, people: 0, top: [] });
  stats.close();
});
