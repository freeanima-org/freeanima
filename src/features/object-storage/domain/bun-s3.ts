import { S3Client, type S3Options } from "bun";

import type { ObjectStorageConfigInput } from "@freeanima/host/core/config";
import { resolveValue } from "@freeanima/host/platform/config";

export type ResolvedObjectStorageCreds = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

/**
 * 阿里云 OSS：区域根 host（`oss-cn-*.aliyuncs.com`）在 Bun S3Client + 虚拟托管下会报 InvalidBucketName。
 * 须写成 `https://{bucket}.oss-cn-*.aliyuncs.com`。已带 bucket 前缀则不动。
 */
export function normalizeObjectStorageEndpoint(endpoint: string, bucket: string): string {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  const b = bucket.trim();
  if (!trimmed || !b) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const host = url.hostname;
  // oss-cn-beijing.aliyuncs.com / oss-cn-beijing-internal.aliyuncs.com
  if (!/^oss-[a-z0-9-]+\.aliyuncs\.com$/i.test(host)) return trimmed;
  if (host.toLowerCase().startsWith(`${b.toLowerCase()}.`)) return trimmed;
  url.hostname = `${b}.${host}`;
  return url.toString().replace(/\/$/, "");
}

/** Bun：`virtualHostedStyle` ≈ 非 path-style；MinIO 等常需 path-style（不设 virtualHostedStyle） */
export function bunS3OptionsFromResolved(creds: ResolvedObjectStorageCreds): S3Options {
  const endpoint = normalizeObjectStorageEndpoint(creds.endpoint, creds.bucket);
  return {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    bucket: creds.bucket,
    endpoint,
    region: creds.region,
    ...(creds.forcePathStyle ? {} : { virtualHostedStyle: true as const }),
  };
}

export function createBunS3Client(creds: ResolvedObjectStorageCreds): S3Client {
  return new S3Client(bunS3OptionsFromResolved(creds));
}

export async function resolveObjectStorageCreds(
  cfg: ObjectStorageConfigInput,
): Promise<ResolvedObjectStorageCreds | null> {
  const endpointRaw = cfg.endpoint?.trim().replace(/\/$/, "");
  const bucket = cfg.bucket?.trim();
  const accessKeyRaw = cfg.access_key_id?.trim();
  const secretRaw = cfg.secret_access_key?.trim();
  if (!endpointRaw || !bucket || !accessKeyRaw || !secretRaw) return null;

  const accessKeyId = await resolveValue(accessKeyRaw);
  const secretAccessKey = await resolveValue(secretRaw);
  return {
    endpoint: normalizeObjectStorageEndpoint(endpointRaw, bucket),
    bucket,
    region: cfg.region?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    forcePathStyle: cfg.force_path_style === true,
  };
}
