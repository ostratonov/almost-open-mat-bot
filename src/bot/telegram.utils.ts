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

const MESSAGE_KINDS = ['text', 'sticker', 'animation', 'video', 'video_note', 'voice', 'audio', 'document', 'photo', 'location', 'contact', 'poll'] as const;

export function messageKind(message: Message): string {
  return MESSAGE_KINDS.find((kind) => kind in message) ?? 'other';
}

export function commandName(text: string): string {
  return text.slice(1).split(/[@\s]/)[0].toLowerCase();
}

export function pictureFileId(message: Pick<Message, 'photo' | 'document'>): string | undefined {
  if (message.photo) return largestPhoto(message.photo).file_id;
  if (message.document && isImage(message.document)) return message.document.file_id;
  return undefined;
}

export function botPhotoId(message: Pick<Message, 'from' | 'photo'>, botId: number): string | undefined {
  return message.from?.id === botId && message.photo ? largestPhoto(message.photo).file_id : undefined;
}

export function album(photos: InputFile[]): InputMediaPhoto[] {
  return photos.map((photo) => InputMediaBuilder.photo(photo));
}

export async function downloadFile(botToken: string, filePath: string): Promise<Buffer> {
  const res = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!res.ok) throw new Error(`file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
