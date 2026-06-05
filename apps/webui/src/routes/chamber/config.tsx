import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc.ts";

export const Route = createFileRoute("/chamber/config")({
  loader: () => trpc.status.config.query().catch(() => null),
  component: ConfigPage,
});

function maskSecret(key: string, value: unknown) {
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

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">⚙️ 配置</h2>
      <p className="text-sm text-base-content/60 mb-4">逸灵风运行时配置。密钥值已隐藏。</p>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>键</th>
              <th>值</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(config as Record<string, unknown>).map(([k, v]) => (
              <tr key={k}>
                <td className="font-mono text-xs">{k}</td>
                <td className="font-mono text-xs">{maskSecret(k, v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
