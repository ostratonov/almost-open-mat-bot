export interface Config {
  botToken: string;
  trainerChatId: string;
  ownerId?: number;
  statsPath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const { BOT_TOKEN, TRAINER_CHAT_ID, OWNER_ID, STATS_PATH } = env;
  if (!BOT_TOKEN || !TRAINER_CHAT_ID) throw new Error('BOT_TOKEN and TRAINER_CHAT_ID must be set');
  if (OWNER_ID && !/^\d+$/.test(OWNER_ID)) throw new Error('OWNER_ID must be a Telegram user id');
  return {
    botToken: BOT_TOKEN,
    trainerChatId: TRAINER_CHAT_ID,
    ownerId: OWNER_ID ? Number(OWNER_ID) : undefined,
    statsPath: STATS_PATH ?? 'data/stats.sqlite',
  };
}

export const config = loadConfig();
