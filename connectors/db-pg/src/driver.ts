export type DatabaseDriver = "postgres" | "bun";

/** 运行时 PG 驱动：`DATABASE_DRIVER=bun` 启用 Bun.sql，默认 postgres.js */
export function getDatabaseDriver(): DatabaseDriver {
  const raw = process.env.DATABASE_DRIVER?.trim().toLowerCase();
  if (raw === "bun") return "bun";
  return "postgres";
}
