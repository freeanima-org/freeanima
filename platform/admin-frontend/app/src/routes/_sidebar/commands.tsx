import { createFileRoute } from "@tanstack/react-router";
import { listConversationCommands } from "@admin/lib/api.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/commands")({
  loader: () =>
    listConversationCommands({ all: true }).catch(
      catchWithFallback("commands/listConversationCommands", { commands: [] }),
    ),
  staleTime: 5 * 60_000,
  component: CommandsPage,
});

type CommandRow = {
  name: string;
  description?: string;
  scope?: string;
  platforms?: string[];
};

function formatPlatforms(platforms?: string[]) {
  if (!platforms?.length) return m.admin_common_all();
  return platforms.join(", ");
}

function CommandsPage() {
  const data = Route.useLoaderData() as { commands?: CommandRow[] };
  const commands = (data.commands ?? []) as CommandRow[];

  const conversationCommands = commands.filter((c) => c.scope === "conversation");
  const globalCommands = commands.filter((c) => c.scope === "global");

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_commands()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_commands_desc()}</p>

      {conversationCommands.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">{m.admin_commands_conversation_scope()}</h3>
          <p className="text-xs text-base-content/50 mb-2">
            {m.admin_commands_conversation_hint({
              count: String(conversationCommands.length),
            })}
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-48">{m.admin_commands_command()}</th>
                  <th>{m.admin_commands_description()}</th>
                </tr>
              </thead>
              <tbody>
                {conversationCommands.map((cmd) => (
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
          <h3 className="text-sm font-semibold mb-2">{m.admin_commands_global_scope()}</h3>
          <p className="text-xs text-base-content/50 mb-2">
            {m.admin_commands_global_hint({ count: String(globalCommands.length) })}
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-48">{m.admin_commands_command()}</th>
                  <th>{m.admin_commands_description()}</th>
                  <th className="w-40">{m.admin_commands_platform()}</th>
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

      {conversationCommands.length === 0 && globalCommands.length === 0 ? (
        <div className="alert alert-info text-sm">{m.admin_commands_empty()}</div>
      ) : null}
    </div>
  );
}
