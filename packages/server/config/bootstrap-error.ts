import type { z } from "zod";

/** config.yaml 缺失时的可读说明 */
export function formatMissingConfigYamlError(configPath: string): string {
  return [
    `config.yaml 不存在：${configPath}`,
    "请复制仓库根目录 config.example.yaml，并至少配置 database.url，例如：",
    "  database:",
    "    url: postgresql://anima:anima@127.0.0.1:5432/anima",
    "也可设置环境变量 DATABASE_URL。详见 docs/ops/database.md。",
  ].join("\n");
}

/** bootstrap 段 Zod 校验失败 → 可读说明（区分「配置缺失」与「PG 连不上」） */
export function formatBootstrapConfigError(
  error: Pick<z.ZodError, "issues">,
  configPath: string,
): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });

  const touchesDatabase = error.issues.some((issue) => issue.path[0] === "database");
  const hints: string[] = [];
  if (touchesDatabase) {
    hints.push(
      "",
      "这是 bootstrap 配置缺失或无效，不是「PostgreSQL 还没连上」。",
      `请在 ${configPath} 配置 database.url，例如：`,
      "  database:",
      "    url: postgresql://anima:anima@127.0.0.1:5432/anima",
      '或设置环境变量 DATABASE_URL（配合 url: env("DATABASE_URL")）。',
      "YAML 顶层键不要缩进；database 须与 redis/http 同级。",
    );
  }

  return [`config.yaml bootstrap 校验失败（${configPath}）：`, ...lines, ...hints].join("\n");
}
