export class RateLimiter {
  private readonly hits = new Map<number, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  tryTake(key: number, count = 1, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    const allowed = recent.length + count <= this.limit;
    if (allowed) recent.push(...Array<number>(count).fill(now));
    this.hits.set(key, recent);
    return allowed;
  }
}
