import type { Context } from 'grammy';
import type { MessageEntity } from 'grammy/types';

export interface PhotoCaption {
  caption: string;
  caption_entities: MessageEntity[];
}

export interface RenderedPicture {
  image: Buffer;
  timings: string;
}

export interface PendingPicture {
  ctx: Context;
  placeholderId?: number;
}
