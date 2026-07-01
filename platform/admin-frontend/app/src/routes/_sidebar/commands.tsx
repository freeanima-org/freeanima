import { createFileRoute } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
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
      <p className="text-sm text-muted-foreground mb-4">{m.admin_commands_desc()}</p>

      {conversationCommands.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">{m.admin_commands_conversation_scope()}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            {m.admin_commands_conversation_hint({
              count: String(conversationCommands.length),
            })}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{m.admin_commands_command()}</TableHead>
                  <TableHead>{m.admin_commands_description()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversationCommands.map((cmd) => (
                  <TableRow key={cmd.name}>
                    <TableCell className="font-mono text-sm">/{cmd.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cmd.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {globalCommands.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-2">{m.admin_commands_global_scope()}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            {m.admin_commands_global_hint({ count: String(globalCommands.length) })}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{m.admin_commands_command()}</TableHead>
                  <TableHead>{m.admin_commands_description()}</TableHead>
                  <TableHead className="w-40">{m.admin_commands_platform()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalCommands.map((cmd) => (
                  <TableRow key={cmd.name}>
                    <TableCell className="font-mono text-sm">/{cmd.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cmd.description}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatPlatforms(cmd.platforms)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {conversationCommands.length === 0 && globalCommands.length === 0 ? (
        <StatusAlert variant="info">{m.admin_commands_empty()}</StatusAlert>
      ) : null}
    </div>
  );
}
