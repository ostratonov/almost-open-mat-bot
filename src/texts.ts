import type { BotCommand } from 'grammy/types';

export enum Command {
  Start = 'start',
  Suggest = 'suggest',
  Support = 'support',
  ChatId = 'chatid',
}

export const TEXTS = {
  about: 'привіт, дай мені картинку і все буде almost open mat',
  support: 'іді нахуй',
  notAnImage: 'це не картинка, петушара',
  drawing: 'дєлаю свойо...',
  cannotOpen: 'Не зміг відкрити цю картинку',
  sendPictureFirst: 'спершу кинь картинку',
  replyToCaptioned: 'реплайни /suggest на картинку з написом від мене',
  tooManyPictures: 'забагато картинок за раз, видихни хвилинку і потім ще кинеш',
  tooManySuggestions:
    'ти almost перенасичив чат тренера своїми прекрасними світлинами. посиди трошки пару хв, потім ще кинеш. осс',
  sentToTrainer: 'відправлено, шукай себе в прошмандовках культа',
  suggestedBy: 'від ',
} as const;

export const MENU: BotCommand[] = [
  { command: Command.Start, description: 'що вміє бот' },
  { command: Command.Suggest, description: 'відправити останню картинку тренеру' },
  { command: Command.Support, description: 'підтримка' },
];
