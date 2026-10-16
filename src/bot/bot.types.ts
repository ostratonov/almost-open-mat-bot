import type { Context } from 'grammy';
import type { MessageEntity } from 'grammy/types';

export interface PhotoCaption {
  caption: string;
  caption_entities: MessageEntity[];
}

export interface PictureTimings {
  kb: number;
  getFileMs: number;
  downloadMs: number;
  captionMs: number;
}

export interface RenderedPicture {
  image: Buffer;
  timings: PictureTimings;
}

export interface PendingPicture {
  ctx: Context;
  placeholderId?: number;
}

export enum BotEvent {
  Started = 'started',
  Alive = 'alive',
  Picture = 'picture',
  PictureFailed = 'picture_failed',
  Answer = 'answer',
  Suggestion = 'suggestion',
  RateLimited = 'rate_limited',
  Error = 'error',
}

export enum Limit {
  Pictures = 'pictures',
  Suggestions = 'suggestions',
}
