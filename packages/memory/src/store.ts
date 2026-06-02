import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  createFact,
  factScore,
  factToFileText,
  parseFact,
  nowIso,
  type FactData,
} from "./fact.js";
import { PATHS } from "@freeanima/legacy-kernel";

const COUNTER_FILE = ".counter";
const FACT_PREFIX = "f-";

function listOverlap(a: string[], b: string[]): boolean {
  if (!b.length) return true;
  const setB = new Set(b);
  return a.some((item) => setB.has(item));
}

function readCounter(dir: string): number {
  const p = join(dir, COUNTER_FILE);
  if (!existsSync(p)) return 0;
  try {
    return parseInt(readFileSync(p, "utf-8").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function writeCounter(dir: string, value: number): void {
  writeFileSync(join(dir, COUNTER_FILE), String(value), "utf-8");
}

export function generateId(memoryDir: string): string {
  const seq = readCounter(memoryDir) + 1;
  writeCounter(memoryDir, seq);
  const rand = randomBytes(2).toString("hex");
  return `${FACT_PREFIX}${String(seq).padStart(6, "0")}-${rand}`;
}

export class MemoryStore {
  readonly path: string;

  constructor(path?: string) {
    this.path = path ?? PATHS.memory;
    mkdirSync(this.path, { recursive: true });
  }

  private pathFor(factId: string): string {
    return join(this.path, `${factId}.md`);
  }

  private write(fact: FactData): void {
    writeFileSync(this.pathFor(fact.id), factToFileText(fact), "utf-8");
  }

  private iterAll(): FactData[] {
    const facts: FactData[] = [];
    try {
      for (const name of readdirSync(this.path).sort()) {
        if (!name.startsWith(FACT_PREFIX) || !name.endsWith(".md")) continue;
        const f = parseFact(readFileSync(join(this.path, name), "utf-8"));
        if (f) facts.push(f);
      }
    } catch {
      /* empty */
    }
    return facts;
  }

  create(partial: Partial<FactData> & { content: string }): string {
    const fact = createFact(partial);
    if (!fact.id) fact.id = generateId(this.path);
    if (!fact.created) fact.created = nowIso();
    fact.updated = fact.created;
    this.write(fact);
    return fact.id;
  }

  get(factId: string): FactData | null {
    const p = this.pathFor(factId);
    if (!existsSync(p)) return null;
    try {
      return parseFact(readFileSync(p, "utf-8"));
    } catch {
      return null;
    }
  }

  update(fact: FactData): void {
    if (!fact.id) throw new Error("Cannot update fact without id");
    fact.updated = nowIso();
    this.write(fact);
  }

  delete(factId: string): boolean {
    const p = this.pathFor(factId);
    if (!existsSync(p)) return false;
    unlinkSync(p);
    return true;
  }

  filter(opts?: {
    domains?: string[];
    threads?: string[];
    entities?: string[];
    types?: string[];
    minConfidence?: number;
    minImportance?: number;
    minRecall?: number;
  }): FactData[] {
    const o = opts ?? {};
    const results: FactData[] = [];
    for (const fact of this.iterAll()) {
      if (fact.confidence < (o.minConfidence ?? 0)) continue;
      if (fact.importance < (o.minImportance ?? 0)) continue;
      if (fact.recall < (o.minRecall ?? 0)) continue;
      if (o.types?.length && !o.types.includes(fact.type)) continue;
      if (o.domains?.length && !listOverlap(fact.domains, o.domains)) continue;
      if (o.threads?.length && !listOverlap(fact.threads, o.threads)) continue;
      if (o.entities?.length && !listOverlap(fact.entities, o.entities)) continue;
      results.push(fact);
    }
    return results;
  }

  resident(topN = 20): FactData[] {
    const candidates = this.filter({
      minConfidence: 0.8,
      minImportance: 0.8,
      minRecall: 0.8,
    });
    candidates.sort((a, b) => factScore(b) - factScore(a));
    return candidates.slice(0, topN);
  }

  search(query: string): FactData[] {
    const q = query.toLowerCase();
    const results: FactData[] = [];
    for (const fact of this.iterAll()) {
      if (fact.content.toLowerCase().includes(q)) {
        results.push(fact);
        continue;
      }
      if (fact.entities.some((e) => e.toLowerCase().includes(q))) {
        results.push(fact);
      }
    }
    return results;
  }

  count(): number {
    try {
      return readdirSync(this.path).filter(
        (n) => n.startsWith(FACT_PREFIX) && n.endsWith(".md"),
      ).length;
    } catch {
      return 0;
    }
  }
}

let storeSingleton: MemoryStore | null = null;

export function getStore(): MemoryStore {
  if (!storeSingleton) storeSingleton = new MemoryStore();
  return storeSingleton;
}

export function resetStoreForTests(): void {
  storeSingleton = null;
}
