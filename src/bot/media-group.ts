export class MediaGroupCollector<T> {
  private readonly groups = new Map<string, { items: T[]; timer: NodeJS.Timeout }>();
  private readonly waitMs: number;
  private readonly onReady: (items: T[]) => void;

  constructor(waitMs: number, onReady: (items: T[]) => void) {
    this.waitMs = waitMs;
    this.onReady = onReady;
  }

  has(groupId: string): boolean {
    return this.groups.has(groupId);
  }

  add(groupId: string, item: T): void {
    const group = this.groups.get(groupId) ?? { items: [], timer: undefined! };
    clearTimeout(group.timer);
    group.items.push(item);
    group.timer = setTimeout(() => {
      this.groups.delete(groupId);
      this.onReady(group.items);
    }, this.waitMs);
    this.groups.set(groupId, group);
  }
}
