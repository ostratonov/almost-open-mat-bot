import type { MessageEntity } from 'grammy/types';

export interface PhotoCaption {
  caption: string;
  caption_entities: MessageEntity[];
}
