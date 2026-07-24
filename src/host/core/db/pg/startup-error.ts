export type FormatPgStartupErrorOptions = {
  databaseUrl: string;
};

type PgStartupIssue =
  | "database_missing"
  | "auth_failed"
  | "connection_refused"
  | "extension_missing"
  | "unknown";

type ErrorLink = {
  name?: string;
  message: string;
  code?: string;
};

/** 从 database.url 解析库名（不含密码） */
export function parseDatabaseNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

/** 从 database.url 解析 host:port（不含凭据） */
export function parseDatabaseEndpointFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const port = parsed.port.length > 0 ? parsed.port : "5432";
    return `${parsed.hostname}:${port}`;
  } catch {
    return null;
  }
}

function collectErrorChain(err: unknown): ErrorLink[] {
  const chain: ErrorLink[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;

  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const withCode = current as Error & { code?: string };
      const link: ErrorLink = {
        name: withCode.name,
        message: withCode.message,
      };
      if (withCode.code) {
        link.code = withCode.code;
      }
      chain.push(link);
      current = withCode.cause;
      continue;
    }
    if (typeof current === "string") {
      chain.push({ message: current });
      break;
    }
    break;
  }

  return chain;
}

function classifyPgStartupIssue(chain: ErrorLink[]): PgStartupIssue {
  const text = chain
    .map((link) => link.message)
    .join(" ")
    .toLowerCase();
  const codes = new Set(
    chain.map((link) => link.code).filter((code): code is string => Boolean(code)),
  );

  if (codes.has("3D000") || /database .* does not exist/.test(text)) {
    return "database_missing";
  }
  if (codes.has("28P01") || /password authentication failed/.test(text)) {
    return "auth_failed";
  }
  if (
    codes.has("ECONNREFUSED") ||
    /connection refused/.test(text) ||
    /connect econnrefused/.test(text) ||
    /could not connect to server/.test(text) ||
    /host unreachable/.test(text) ||
    /no route to host/.test(text)
  ) {
    return "connection_refused";
  }
  if (
    /extension "vector" does not exist/.test(text) ||
    /extension "pg_trgm" does not exist/.test(text) ||
    /type "vector" does not exist/.test(text) ||
    /undefined object: extension/.test(text)
  ) {
    return "extension_missing";
  }

  return "unknown";
}

function redactSecrets(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

function summarizeRootError(chain: ErrorLink[]): string {
  const root = chain[0];
  if (!root) return "未知错误";
  const summary = redactSecrets(root.message).split("\n")[0] ?? root.message;
  return summary.slice(0, 240);
}

function buildStartupMessage(
  issue: Exclude<PgStartupIssue, "unknown">,
  opts: FormatPgStartupErrorOptions,
): string {
  const dbName = parseDatabaseNameFromUrl(opts.databaseUrl) ?? "（无法解析库名）";
  const endpoint = parseDatabaseEndpointFromUrl(opts.databaseUrl) ?? "（无法解析地址）";

  switch (issue) {
    case "database_missing":
      return [
        `PostgreSQL 数据库 "${dbName}" 不存在。`,
        "下一步：",
        `  1. 用超级用户创建数据库，例如：sudo -u postgres createdb -O <用户> ${dbName}`,
        "  2. 或将 config.yaml 中 database.url 改为已有数据库名",
        "  3. 完整安装步骤见 docs/guide/database.md 与 scripts/setup-postgres-debian.sh",
      ].join("\n");
    case "auth_failed":
      return [
        `无法使用当前凭据连接 PostgreSQL（${endpoint}）。`,
        "下一步：",
        "  1. 核对 config.yaml 中 database.url 的用户名与密码",
        "  2. 若使用 env() / vault()，确认环境变量或 Vault 条目可读且值正确",
        "  3. 详见 docs/guide/database.md",
      ].join("\n");
    case "connection_refused":
      return [
        `无法连接到 PostgreSQL（${endpoint}）。`,
        "下一步：",
        "  1. 确认 PostgreSQL 服务已启动（例如 systemctl status postgresql）",
        "  2. 核对 database.url 中的 host 与 port",
        "  3. Debian 本机安装可参考 scripts/setup-postgres-debian.sh",
        "  4. 详见 docs/guide/database.md",
      ].join("\n");
    case "extension_missing":
      return [
        `数据库 "${dbName}" 缺少必需扩展（pg_trgm / vector）。`,
        "下一步：",
        `  1. 以超级用户执行：sudo -u postgres psql -d ${dbName} -f src/host/core/scripts/ensure-pg-extensions.sql`,
        "  2. 详见 docs/guide/database.md",
      ].join("\n");
  }
}

function buildStartupMessageFromChain(
  issue: PgStartupIssue,
  opts: FormatPgStartupErrorOptions,
  chain: ErrorLink[],
): string {
  if (issue === "unknown") {
    return [
      "PostgreSQL 启动检查失败。",
      `原因摘要：${summarizeRootError(chain)}`,
      "详见 docs/guide/database.md 的 Troubleshooting。",
    ].join("\n");
  }
  return buildStartupMessage(issue, opts);
}

/** 将连库 / 迁移失败包装为可操作的启动错误（保留原始 cause） */
export function formatPgStartupError(err: unknown, opts: FormatPgStartupErrorOptions): Error {
  const chain = collectErrorChain(err);
  const issue = classifyPgStartupIssue(chain);
  const message = buildStartupMessageFromChain(issue, opts, chain);
  const wrapped = new Error(message);
  wrapped.name = "PgStartupError";
  wrapped.cause = err;
  return wrapped;
}
