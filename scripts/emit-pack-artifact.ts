/**
 * 将 pack 产物写入 dist/：版本化主名 + updater 固定别名（+ 可选 legacy 别名）。
 */
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  packArtifactLegacyAliases,
  packArtifactStableName,
  packArtifactVersionedName,
  resolvePackArtifactMeta,
  type PackArtifactKind,
} from "@freeanima/habitat/core/config/pack-artifact-names.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export type EmitPackArtifactResult = {
  kind: PackArtifactKind;
  versionedPath: string;
  stablePath: string;
  aliasPaths: string[];
  meta: ReturnType<typeof resolvePackArtifactMeta>;
};

export function emitPackArtifact(options: {
  kind: PackArtifactKind;
  sourcePath: string;
  distDir?: string;
  logPrefix?: string;
  /** 默认写出 legacy 别名（windows/android 本地脚本） */
  includeLegacyAliases?: boolean;
}): EmitPackArtifactResult {
  const distDir = options.distDir ?? join(root, "dist");
  const logPrefix = options.logPrefix ?? "[pack-artifact]";
  const includeLegacy = options.includeLegacyAliases ?? true;
  const meta = resolvePackArtifactMeta(root);
  const versionedName = packArtifactVersionedName(options.kind, meta);
  const stableName = packArtifactStableName(options.kind);
  const aliases = includeLegacy ? packArtifactLegacyAliases(options.kind) : [];

  mkdirSync(distDir, { recursive: true });
  const versionedPath = join(distDir, versionedName);
  const stablePath = join(distDir, stableName);
  cpSync(options.sourcePath, versionedPath);
  cpSync(options.sourcePath, stablePath);
  const aliasPaths: string[] = [];
  for (const name of aliases) {
    if (name === versionedName || name === stableName) continue;
    const p = join(distDir, name);
    cpSync(options.sourcePath, p);
    aliasPaths.push(p);
  }

  console.log(`${logPrefix} → ${versionedPath}`);
  console.log(`${logPrefix} → ${stablePath} (stable)`);
  for (const p of aliasPaths) {
    console.log(`${logPrefix} → ${p} (legacy)`);
  }

  return { kind: options.kind, versionedPath, stablePath, aliasPaths, meta };
}
