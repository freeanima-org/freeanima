import { createFileRoute } from "@tanstack/react-router";
import { getStatusConfig } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/config")({
  loader: () => getStatusConfig().catch(() => null),
  component: ConfigPage,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function maskSecret(key: string, value: unknown): string {
  const s = value == null ? "" : String(value);
  if (
    key.toLowerCase().includes("key") ||
    key.toLowerCase().includes("token") ||
    key.toLowerCase().includes("secret")
  ) {
    return s ? `${s.slice(0, 8)}…` : "(空)";
  }
  return s || "(空)";
}

function formatDisplayValue(key: string, value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "(空)";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return maskSecret(key, value);
  if (Array.isArray(value)) {
    if (value.every((item) => !isPlainObject(item))) {
      return JSON.stringify(value);
    }
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

function flattenConfigEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) {
      rows.push(...flattenConfigEntries(v, path));
      continue;
    }
    if (Array.isArray(v)) {
      const objectItems = v.filter(isPlainObject);
      if (objectItems.length === v.length && v.length > 0) {
        v.forEach((item, index) => {
          rows.push(...flattenConfigEntries(item as Record<string, unknown>, `${path}[${index}]`));
        });
        continue;
      }
    }
    rows.push({ key: path, value: v });
  }
  return rows;
}

function ConfigBlock({ name, value }: { name: string; value: unknown }) {
  if (isPlainObject(value)) {
    const rows = flattenConfigEntries(value);
    return (
      <section className="card bg-base-200">
        <div className="card-body gap-3">
          <h3 className="font-bold font-mono text-sm">{name}</h3>
          {rows.length === 0 ? (
            <p className="text-xs text-base-content/50">（空）</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th className="w-48">键</th>
                    <th>值</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ key, value: rowValue }) => (
                    <tr key={key}>
                      <td className="font-mono text-xs align-top">{key}</td>
                      <td className="font-mono text-xs whitespace-pre-wrap break-all">
                        {formatDisplayValue(key, rowValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-base-200">
      <div className="card-body gap-2">
        <h3 className="font-bold font-mono text-sm">{name}</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-base-300 p-2 rounded">
          {formatDisplayValue(name, value)}
        </pre>
      </div>
    </section>
  );
}

function ConfigPage() {
  const config = Route.useLoaderData();

  if (config === null) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">⚙️ 配置</h2>
        <div className="alert alert-error text-sm">加载失败</div>
      </div>
    );
  }

  const blocks = Object.entries(config as Record<string, unknown>);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">⚙️ 配置</h2>
      <p className="text-sm text-base-content/60 mb-4">
        逸灵风运行时配置，按 config.yaml 顶层块展示。密钥值已隐藏。
      </p>
      {blocks.length === 0 ? (
        <div className="alert alert-info text-sm">暂无配置项</div>
      ) : (
        <div className="space-y-4">
          {blocks.map(([name, value]) => (
            <ConfigBlock key={name} name={name} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
