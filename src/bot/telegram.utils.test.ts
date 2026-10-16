import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { User } from 'grammy/types';
import { displayName, mentionCaption, pictureFileId } from './telegram.utils.ts';

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

test('a picture is a photo or an image sent as a file, nothing else', () => {
  const photo = { photo: [{ file_id: 'small', file_unique_id: 's', width: 90, height: 90 }, { file_id: 'big', file_unique_id: 'b', width: 1280, height: 1280 }] };
  assert.equal(pictureFileId(photo), 'big');
  assert.equal(pictureFileId({ document: { file_id: 'png', file_unique_id: 'p', mime_type: 'image/png' } }), 'png');
  assert.equal(pictureFileId({ document: { file_id: 'pdf', file_unique_id: 'd', mime_type: 'application/pdf' } }), undefined);
  assert.equal(pictureFileId({}), undefined);
});
