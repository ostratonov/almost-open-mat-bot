import type { BotCommand } from 'grammy/types';

export enum Command {
  Start = 'start',
  Suggest = 'suggest',
  Support = 'support',
}

export const TEXTS = {
  about: 'привіт, дай мені картинку і все буде almost open mat',
  support: 'іді нахуй',
  notAnImage: 'це не картинка, петушара',
  drawing: 'дєлаю свойо...',
  cannotOpen: 'Не зміг відкрити цю картинку',
  replyToCaptioned: 'реплайни /suggest на картинку з написом від мене',
  tooManyPictures: 'забагато картинок за раз, видихни хвилинку і потім ще кинеш',
  tooManySuggestions:
    'ти almost перенасичив чат тренера своїми прекрасними світлинами. посиди трошки пару хв, потім ще кинеш. осс',
  sentToTrainer: 'відправлено, шукай себе в прошмандовках культа',
  suggestedBy: 'від ',
} as const;

export const MENU: BotCommand[] = [
  { command: Command.Start, description: 'що вміє бот' },
  { command: Command.Suggest, description: 'реплайни на картинку з написом, і я відправлю її тренеру' },
  { command: Command.Support, description: 'підтримка' },
];
