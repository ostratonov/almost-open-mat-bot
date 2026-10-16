import type { BotCommand } from 'grammy/types';
import type { PeriodStats } from './stats/stats.types.ts';

export enum Command {
  Start = 'start',
  Suggest = 'suggest',
  Support = 'support',
  AlmostOpenMat = 'almostopenmat',
  Stats = 'stats',
}

export enum CallbackData {
  Suggest = 'suggest',
}

export const TEXTS = {
  about: 'привіт, дай мені картинку і все буде almost open mat',
  support: 'іді нахуй',
  notAnImage: 'це не картинка, петушара',
  drawing: 'дєлаю свойо...',
  cannotOpen: 'Не зміг відкрити цю картинку',
  replyToPicture: 'реплайни /almostopenmat на картинку',
  replyToCaptioned: 'реплайни /suggest на картинку з написом від мене',
  tooManyPictures: 'забагато картинок за раз, видихни хвилинку і потім ще кинеш',
  tooManySuggestions:
    'ти almost перенасичив чат тренера своїми прекрасними світлинами. посиди трошки пару хв, потім ще кинеш. осс',
  sentToTrainer: 'відправлено, шукай себе в прошмандовках культа',
  suggestedBy: 'від ',
  suggestButton: 'запропонувати',
} as const;

export const MENU: BotCommand[] = [
  { command: Command.Start, description: 'що вміє бот' },
  { command: Command.Suggest, description: 'реплайни на картинку з написом, і я відправлю її тренеру' },
  { command: Command.Support, description: 'підтримка' },
];

export const GROUP_MENU: BotCommand[] = [
  { command: Command.AlmostOpenMat, description: 'реплайни на картинку, і буде almost open mat' },
];

export const OWNER_MENU: BotCommand[] = [...MENU, { command: Command.Stats, description: 'статистика за тиждень' }];

export function formatStats(stats: PeriodStats): string {
  const lines = [
    'за тиждень:',
    `картинок: ${stats.pictures} (у групах ${stats.groupPictures})`,
    `пропозицій тренеру: ${stats.suggestions}`,
    `людей: ${stats.people}`,
  ];
  if (stats.top.length) {
    lines.push('', 'найактивніші:');
    stats.top.forEach((user, i) =>
      lines.push(`${i + 1}. ${user.name} — картинки: ${user.pictures}, пропозиції: ${user.suggestions}`),
    );
  }
  return lines.join('\n');
}
