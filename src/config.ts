export interface Config {
  botToken: string;
  trainerChatId: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const { BOT_TOKEN, TRAINER_CHAT_ID } = env;
  if (!BOT_TOKEN || !TRAINER_CHAT_ID) throw new Error('BOT_TOKEN and TRAINER_CHAT_ID must be set');
  return { botToken: BOT_TOKEN, trainerChatId: TRAINER_CHAT_ID };
}

export const config = loadConfig();
