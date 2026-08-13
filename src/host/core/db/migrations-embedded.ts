import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export type EmbeddedMigrationFile = {
  /** drizzle 目录名（含 14 位时间戳前缀） */
  name: string;
  /** `with { type: "file" }` 解析后的路径（编译进二进制时可被 fs 读取） */
  path: string;
};

const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_MIGRATIONS__";

type EmbeddedMigrationsGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: EmbeddedMigrationFile[];
};

/** 由 standalone-boot 经 dir: 注册（type:file 路径） */
export function registerEmbeddedMigrations(files: EmbeddedMigrationFile[]): void {
  (globalThis as EmbeddedMigrationsGlobal)[GLOBAL_KEY] = files;
}

export function getRegisteredEmbeddedMigrations(): EmbeddedMigrationFile[] | null {
  const files = (globalThis as EmbeddedMigrationsGlobal)[GLOBAL_KEY];
  return files && files.length > 0 ? files : null;
}

/** 将嵌入的 migration.sql 落到磁盘目录供 drizzle migrator 使用 */
export function materializeEmbeddedMigrations(files: EmbeddedMigrationFile[]): string {
  const hash = createHash("sha256")
    .update(files.map((f) => f.name).join("\n"))
    .digest("hex")
    .slice(0, 16);
  const dir = join(tmpdir(), `freeanima-migrations-${hash}`);
  const marker = join(dir, ".ok");
  if (existsSync(marker)) return dir;

  for (const file of files) {
    const dest = join(dir, file.name, "migration.sql");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(file.path));
  }
  writeFileSync(marker, "1");
  return dir;
}
