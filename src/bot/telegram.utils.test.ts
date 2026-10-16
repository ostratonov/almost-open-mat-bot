import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { User } from 'grammy/types';
import { displayName, mentionCaption } from './telegram.utils.ts';

const user: User = { id: 1, is_bot: false, first_name: 'Саша', last_name: '🥋' };

test('username wins, otherwise the full name', () => {
  assert.equal(displayName({ ...user, username: 'sasha' }), '@sasha');
  assert.equal(displayName(user), 'Саша 🥋');
  assert.equal(displayName({ ...user, last_name: undefined }), 'Саша');
});

test('mention covers exactly the name, counted in UTF-16 like Telegram', () => {
  const { caption, caption_entities } = mentionCaption('від ', user);
  const [entity] = caption_entities;
  assert.equal(caption.slice(entity.offset, entity.offset + entity.length), 'Саша 🥋');
});
