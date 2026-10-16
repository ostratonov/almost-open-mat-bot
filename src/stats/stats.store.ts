import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { type ActiveUser, type PeriodStats, StatEvent } from './stats.types.ts';

const TOP_SIZE = 5;

export class StatsStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (at INTEGER NOT NULL, kind TEXT NOT NULL, user_id INTEGER NOT NULL, chat_id INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS events_at ON events (at);
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    `);
  }

  record(kind: StatEvent, userId: number, name: string, chatId: number, count = 1, at = Date.now()): void {
    this.db.prepare('INSERT INTO users (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name').run(userId, name);
    const insert = this.db.prepare('INSERT INTO events (at, kind, user_id, chat_id) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < count; i++) insert.run(at, kind, userId, chatId);
  }

  since(from: number): PeriodStats {
    const totals = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(kind = :picture), 0) AS pictures,
           COALESCE(SUM(kind = :picture AND chat_id < 0), 0) AS groupPictures,
           COALESCE(SUM(kind = :suggestion), 0) AS suggestions,
           COUNT(DISTINCT user_id) AS people
         FROM events WHERE at >= :from`,
      )
      .get({ picture: StatEvent.Picture, suggestion: StatEvent.Suggestion, from }) as Omit<PeriodStats, 'top'>;

    const top = this.db
      .prepare(
        `SELECT u.name AS name, SUM(e.kind = :picture) AS pictures, SUM(e.kind = :suggestion) AS suggestions
         FROM events e JOIN users u ON u.id = e.user_id
         WHERE e.at >= :from
         GROUP BY e.user_id
         ORDER BY pictures + suggestions DESC, pictures DESC
         LIMIT :limit`,
      )
      .all({ picture: StatEvent.Picture, suggestion: StatEvent.Suggestion, from, limit: TOP_SIZE }) as unknown as ActiveUser[];

    return { ...totals, top };
  }

  close(): void {
    this.db.close();
  }
}
