export class BoundedCache<T> {
  private values = new Map<string, { data: T; until: number; bytes: number }>();
  private limit: number; private ttl: number; private maxBytes: number; private now: () => number;
  constructor(limit = 50, ttl = 300000, maxBytes = 5_000_000, now: () => number = Date.now) { if (limit < 1 || ttl < 1 || maxBytes < 1) throw new RangeError("Invalid cache limits"); this.limit = limit; this.ttl = ttl; this.maxBytes = maxBytes; this.now = now; }
  get(key: string): T | undefined { const value = this.values.get(key); if (!value) return; if (value.until <= this.now()) { this.values.delete(key); return; } return value.data; }
  set(key: string, data: T) {
    const bytes = JSON.stringify(data).length;
    if (bytes > this.maxBytes) return;
    for (const [id, item] of this.values) if (item.until <= this.now()) this.values.delete(id);
    this.values.delete(key);
    while (this.values.size >= this.limit || [...this.values.values()].reduce((sum, item) => sum + item.bytes, bytes) > this.maxBytes) this.values.delete(this.values.keys().next().value!);
    this.values.set(key, { data, until: this.now() + this.ttl, bytes });
  }
}
