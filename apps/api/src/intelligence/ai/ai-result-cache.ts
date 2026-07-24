import type { AiIntelligenceReport } from "@adam/contracts";

interface CacheEntry {
  readonly expiresAt: number;
  readonly report: AiIntelligenceReport;
}

export class AiResultCache {
  private readonly entries = new Map<string, CacheEntry>();

  public constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  public get(key: string): AiIntelligenceReport | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return {
      ...entry.report,
      cacheHit: true,
    };
  }

  public set(key: string, report: AiIntelligenceReport): void {
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      report: {
        ...report,
        cacheHit: false,
      },
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }
}
