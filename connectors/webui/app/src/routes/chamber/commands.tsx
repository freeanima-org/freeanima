import { createFileRoute } from "@tanstack/react-router";
import { listSessionCommands } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

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
    if (!platforms?.length) return m.webui_common_all();
    return platforms.join(", ");
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_commands()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_commands_desc()}</p>

      {sessionCommands.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">{m.webui_chamber_commands_session_scope()}</h3>
          <p className="text-xs text-base-content/50 mb-2">
            {m.webui_chamber_commands_session_hint({ count: String(sessionCommands.length) })}
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-48">{m.webui_chamber_commands_command()}</th>
                  <th>{m.webui_chamber_commands_description()}</th>
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
          <h3 className="text-sm font-semibold mb-2">{m.webui_chamber_commands_global_scope()}</h3>
          <p className="text-xs text-base-content/50 mb-2">
            {m.webui_chamber_commands_global_hint({ count: String(globalCommands.length) })}
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-48">{m.webui_chamber_commands_command()}</th>
                  <th>{m.webui_chamber_commands_description()}</th>
                  <th className="w-40">{m.webui_chamber_commands_platform()}</th>
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
        <div className="alert alert-info text-sm">{m.webui_chamber_commands_empty()}</div>
      ) : null}
    </div>
  );
}
