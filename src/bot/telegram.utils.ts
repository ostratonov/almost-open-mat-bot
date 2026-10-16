import { type InputFile, InputMediaBuilder } from 'grammy';
import type { Document, InputMediaPhoto, Message, PhotoSize, User } from 'grammy/types';
import type { PhotoCaption } from './bot.types.ts';

export function displayName(user: User): string {
  return user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ');
}

export function mentionCaption(prefix: string, user: User): PhotoCaption {
  const name = displayName(user);
  return {
    caption: prefix + name,
    caption_entities: [{ type: 'text_mention', offset: prefix.length, length: name.length, user }],
  };
}

export function isImage(document: Document): boolean {
  return document.mime_type?.startsWith('image/') ?? false;
}

export function largestPhoto(photos: PhotoSize[]): PhotoSize {
  return photos.at(-1)!;
}

export function botPhotoId(message: Pick<Message, 'from' | 'photo'>, botId: number): string | undefined {
  return message.from?.id === botId && message.photo ? largestPhoto(message.photo).file_id : undefined;
}

export function album(photos: (string | InputFile)[], caption?: PhotoCaption): InputMediaPhoto[] {
  return photos.map((photo, i) => InputMediaBuilder.photo(photo, i === 0 ? caption : undefined));
}

export async function downloadFile(botToken: string, filePath: string): Promise<Buffer> {
  const res = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!res.ok) throw new Error(`file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
