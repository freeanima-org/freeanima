import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { S3Client } from "bun";

import type { ObjectStorageConfigInput } from "@freeanima/host/core/config";

import { cidFromBytes, objectStorageKey } from "./cid.ts";
import { createBunS3Client, resolveObjectStorageCreds } from "./bun-s3.ts";

export type ObjectPutResult = { cid: string; size: number };

export type ObjectStore = {
  put(worldId: number, bytes: Uint8Array): Promise<ObjectPutResult>;
  get(worldId: number, cid: string): Promise<Uint8Array>;
  exists(worldId: number, cid: string): Promise<boolean>;
  delete(worldId: number, cid: string): Promise<void>;
  deleteWorldPrefix(worldId: number): Promise<void>;
};

/** 服务器可丢弃缓存：重启可清（Linux 上多为 /tmp/anima/objects/…） */
export function serverCacheObjectPath(cid: string): string {
  return join(tmpdir(), "anima", "objects", cid.slice(0, 2), cid);
}

export function serverCacheRoot(): string {
  return join(tmpdir(), "anima", "objects");
}

type RemoteS3 = {
  client: S3Client;
  bucket: string;
};

const NOT_CONFIGURED =
  "object_storage 未配置：请在 Habitat 设置 → 对象存储 中填写 S3 兼容 endpoint/bucket/密钥";

/** 未配置 S3 兼容存储；Habitat REST/WS 可按 code 映射 503 */
export class ObjectStorageNotConfiguredError extends Error {
  readonly code = "object_storage_not_configured";
  constructor(message: string = NOT_CONFIGURED) {
    super(message);
    this.name = "ObjectStorageNotConfiguredError";
  }
}

function formatS3Error(op: string, key: string, err: unknown): Error {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  const msg = err instanceof Error ? err.message : String(err);
  const detail = code && code !== msg ? `${code}: ${msg}` : msg;
  return new Error(
    `object_storage ${op} 失败（key=${key}）：${detail}。请检查 Habitat → 对象存储 的 endpoint/bucket/密钥，以及 RAM 是否具备该桶的读写权限（PutObject/GetObject）`,
  );
}

async function buildRemote(cfg: ObjectStorageConfigInput): Promise<RemoteS3 | null> {
  const creds = await resolveObjectStorageCreds(cfg);
  if (!creds) return null;
  return { client: createBunS3Client(creds), bucket: creds.bucket };
}

async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function writeServerCache(cid: string, bytes: Uint8Array): Promise<void> {
  const path = serverCacheObjectPath(cid);
  if (existsSync(path)) return;
  await ensureParentDir(path);
  await writeFile(path, bytes);
}

export function createObjectStore(cfg: ObjectStorageConfigInput = {}): ObjectStore {
  let remotePromise: Promise<RemoteS3 | null> | null = null;
  const getRemote = (): Promise<RemoteS3 | null> => {
    remotePromise ??= buildRemote(cfg);
    return remotePromise;
  };

  const requireRemote = async (): Promise<RemoteS3> => {
    const remote = await getRemote();
    if (!remote) throw new ObjectStorageNotConfiguredError();
    return remote;
  };

  return {
    async put(worldId, bytes) {
      const remote = await requireRemote();
      const cid = cidFromBytes(bytes);
      const size = bytes.byteLength;
      const key = objectStorageKey(worldId, cid);
      // 内容寻址：同 key 覆盖无害。勿先 Head/exists——Bun+阿里云 OSS 常把 HEAD 打成 UnknownError，掩盖真实 AccessDenied。
      try {
        await remote.client.write(key, bytes);
      } catch (e) {
        throw formatS3Error("put", key, e);
      }
      await writeServerCache(cid, bytes);
      return { cid, size };
    },

    async get(worldId, cid) {
      const cachePath = serverCacheObjectPath(cid);
      if (existsSync(cachePath)) {
        return new Uint8Array(await readFile(cachePath));
      }

      const remote = await requireRemote();
      const key = objectStorageKey(worldId, cid);
      try {
        const bytes = new Uint8Array(await remote.client.file(key).bytes());
        await writeServerCache(cid, bytes);
        return bytes;
      } catch (e) {
        throw formatS3Error("get", key, e);
      }
    },

    async exists(worldId, cid) {
      if (existsSync(serverCacheObjectPath(cid))) return true;
      const remote = await getRemote();
      if (!remote) return false;
      try {
        return await remote.client.file(objectStorageKey(worldId, cid)).exists();
      } catch {
        return false;
      }
    },

    async delete(worldId, cid) {
      const cachePath = serverCacheObjectPath(cid);
      if (existsSync(cachePath)) {
        await rm(cachePath, { force: true });
      }
      const remote = await requireRemote();
      await remote.client.delete(objectStorageKey(worldId, cid));
    },

    async deleteWorldPrefix(worldId) {
      const remote = await requireRemote();
      const prefix = `world/${worldId}/`;
      let startAfter: string | undefined;
      for (;;) {
        const listed = await remote.client.list({
          prefix,
          maxKeys: 1000,
          ...(startAfter !== undefined ? { startAfter } : {}),
        });
        const contents = listed.contents ?? [];
        for (const obj of contents) {
          if (obj.key) await remote.client.delete(obj.key);
        }
        if (!listed.isTruncated || contents.length === 0) break;
        const lastKey = contents.at(-1)?.key;
        if (!lastKey) break;
        startAfter = lastKey;
      }
      /* 服务器缓存按 cid 全局共享，不清整树；依赖 /tmp 重启回收 */
    },
  };
}

let injected: ObjectStore | null = null;

export function bindObjectStore(store: ObjectStore): void {
  injected = store;
}

export function getObjectStore(): ObjectStore {
  if (!injected) {
    injected = createObjectStore({});
  }
  return injected;
}

export function resetObjectStoreForTest(): void {
  injected = null;
}

export { NOT_CONFIGURED as OBJECT_STORAGE_NOT_CONFIGURED };
