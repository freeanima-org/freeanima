import { createFileRoute } from "@tanstack/react-router";
import { listSessionCommands } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/commands")({
  loader: () => listSessionCommands({ all: true }).catch(() => ({ commands: [] })),
  component: CommandsPage,
});

type CommandRow = {
  name: string;
  description?: string;
  scope?: string;
  platforms?: string[];
};

function CommandsPage() {
  const data = Route.useLoaderData() as { commands?: CommandRow[] };
  const commands = (data.commands ?? []) as CommandRow[];

  const sessionCommands = commands.filter((c) => c.scope === "session");
  const globalCommands = commands.filter((c) => c.scope === "global");

  const formatPlatforms = (platforms?: string[]) => {
    if (!platforms?.length) return "全部";
    return platforms.join(", ");
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">⌨️ Slash 命令</h2>
      <p className="text-sm text-base-content/60 mb-4">
        在对话输入框以 <code className="text-xs">/</code> 开头即可触发。命令按作用域分为两类。
      </p>

      {sessionCommands.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">当前 session</h3>
          <p className="text-xs text-base-content/50 mb-2">
            所有平台默认可用（共 {sessionCommands.length} 个）。
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-48">命令</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {sessionCommands.map((cmd) => (
                  <tr key={cmd.name}>
                    <td className="font-mono text-sm">/{cmd.name}</td>
                    <td className="text-sm text-base-content/80">{cmd.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {globalCommands.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-2">其它</h3>
          <p className="text-xs text-base-content/50 mb-2">
            跨 session 或平台级操作（共 {globalCommands.length} 个）。
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-48">命令</th>
                  <th>说明</th>
                  <th className="w-40">平台</th>
                </tr>
              </thead>
              <tbody>
                {globalCommands.map((cmd) => (
                  <tr key={cmd.name}>
                    <td className="font-mono text-sm">/{cmd.name}</td>
                    <td className="text-sm text-base-content/80">{cmd.description}</td>
                    <td className="text-xs text-base-content/60">
                      {formatPlatforms(cmd.platforms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!sessionCommands.length && !globalCommands.length ? (
        <div className="alert alert-info text-sm">暂无已注册的 slash 命令。</div>
      ) : null}
    </div>
  );
}
