export interface StampRecord {
  readonly spreadId: string;
  readonly stampId: string;
  readonly definitionId: string;
  readonly runId: string;
  readonly step: number;
}
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
/** Access to localStorage itself can throw in private/blocked contexts. */
export function browserProgressStorage(): ProgressStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
const valid = (v: unknown): v is StampRecord => {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<StampRecord>;
  return (
    [r.spreadId, r.stampId, r.definitionId, r.runId].every(
      (s) => typeof s === "string" && s.length > 0 && s.length < 512,
    ) &&
    Number.isInteger(r.step) &&
    r.step! >= 0
  );
};
/** Versioned, bounded, best-effort local progress. Storage never decides whether a check passed. */
export class ChallengeProgress {
  private records: StampRecord[] = [];
  readonly key = "hachure.challenge-progress.v1";
  constructor(private readonly storage: ProgressStorage | undefined) {
    try {
      const text = storage?.getItem(this.key);
      if (!text || text.length > 100000) return;
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") return;
      const data = parsed as { version?: unknown; stamps?: unknown };
      if (data.version !== 1 || !Array.isArray(data.stamps)) return;
      this.records = data.stamps.filter(valid).slice(-200);
    } catch {
      /* Unavailable or malformed storage degrades to in-memory progress. */
    }
  }
  get(spreadId: string, stampId: string, definitionId: string): StampRecord | undefined {
    const found = this.records.find(
      (r) => r.spreadId === spreadId && r.stampId === stampId && r.definitionId === definitionId,
    );
    return found ? { ...found } : undefined;
  }
  record(record: StampRecord): void {
    if (!valid(record)) throw new RangeError("Invalid stamp record");
    if (this.get(record.spreadId, record.stampId, record.definitionId)) return;
    this.records = [...this.records.slice(-199), { ...record }];
    try {
      this.storage?.setItem(this.key, JSON.stringify({ version: 1, stamps: this.records }));
    } catch {
      /* The current session still keeps its earned stamp. */
    }
  }
}
