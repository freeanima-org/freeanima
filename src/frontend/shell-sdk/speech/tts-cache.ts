import type { HabitatTtsSynthesizeParams } from "./tts-api.ts";

export const TTS_CACHE_MAX_ENTRIES = 32;
export const TTS_CACHE_MAX_BYTES = 32 * 1024 * 1024;

export type TtsCacheKeyParams = Pick<
  HabitatTtsSynthesizeParams,
  "text" | "lang" | "voice" | "appLocale" | "rate" | "pitch" | "volume"
>;

type CacheEntry = {
  buffer: ArrayBuffer;
  size: number;
};

type LruNode = {
  key: string;
  prev: LruNode | null;
  next: LruNode | null;
};

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function serializeTtsCacheParams(params: TtsCacheKeyParams): string {
  const normalizedText = params.text.replace(/\s+/g, " ").trim();
  return JSON.stringify({
    text: normalizedText,
    lang: params.lang ?? null,
    voice: params.voice ?? null,
    appLocale: params.appLocale,
    rate: params.rate ?? 1,
    pitch: params.pitch ?? 1,
    volume: params.volume ?? 1,
  });
}

export async function buildTtsCacheKey(params: TtsCacheKeyParams): Promise<string> {
  const payload = serializeTtsCacheParams(params);
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const bytes = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return fnv1aHash(payload);
}

export class TtsAudioCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly nodes = new Map<string, LruNode>();
  private head: LruNode | null = null;
  private tail: LruNode | null = null;
  private totalBytes = 0;

  get(key: string): ArrayBuffer | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.touch(key);
    return entry.buffer;
  }

  set(key: string, buffer: ArrayBuffer): void {
    const size = buffer.byteLength;
    if (size === 0) return;

    const existing = this.entries.get(key);
    if (existing) {
      this.totalBytes -= existing.size;
      this.entries.delete(key);
      this.removeNode(key);
    }

    while (
      (this.entries.size >= TTS_CACHE_MAX_ENTRIES ||
        this.totalBytes + size > TTS_CACHE_MAX_BYTES) &&
      this.tail
    ) {
      this.evictTail();
    }

    if (size > TTS_CACHE_MAX_BYTES) return;

    this.entries.set(key, { buffer, size });
    this.totalBytes += size;
    this.pushHead(key);
  }

  clear(): void {
    this.entries.clear();
    this.nodes.clear();
    this.head = null;
    this.tail = null;
    this.totalBytes = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  private touch(key: string): void {
    const node = this.nodes.get(key);
    if (!node || node === this.head) return;
    this.detach(node);
    this.attachHead(node);
  }

  private pushHead(key: string): void {
    const node: LruNode = { key, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.nodes.set(key, node);
  }

  private removeNode(key: string): void {
    const node = this.nodes.get(key);
    if (!node) return;
    this.detach(node);
    this.nodes.delete(key);
  }

  private detach(node: LruNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  private attachHead(node: LruNode): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private evictTail(): void {
    if (!this.tail) return;
    const key = this.tail.key;
    const entry = this.entries.get(key);
    if (entry) {
      this.totalBytes -= entry.size;
      this.entries.delete(key);
    }
    this.removeNode(key);
  }
}

let sharedCache: TtsAudioCache | null = null;

export function getTtsAudioCache(): TtsAudioCache {
  if (!sharedCache) {
    sharedCache = new TtsAudioCache();
  }
  return sharedCache;
}

export function setTtsAudioCacheForTests(cache: TtsAudioCache | null): void {
  sharedCache = cache;
}
