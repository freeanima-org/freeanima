import { createFileRoute } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { listConversationCommands } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { catchWithFallback } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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
  subcommands?: { name: string; description: string }[];
};

function formatPlatforms(platforms?: string[]) {
  if (!platforms?.length) return m.habitat_common_all();
  return platforms.join(", ");
}

function formatSubcommands(subcommands?: { name: string; description: string }[]) {
  if (!subcommands?.length) return null;
  return subcommands.map((s) => s.name).join(", ");
}

function CommandDescription({ cmd }: { cmd: CommandRow }) {
  const subs = formatSubcommands(cmd.subcommands);
  return (
    <div className="text-sm text-muted-foreground">
      <div>{cmd.description}</div>
      {subs ? <div className="mt-0.5 font-mono text-xs opacity-80">{subs}</div> : null}
    </div>
  );
}

function CommandsPage() {
  const data = Route.useLoaderData() as { commands?: CommandRow[] };
  const commands = (data.commands ?? []) as CommandRow[];

  const conversationCommands = commands.filter((c) => c.scope === "conversation");
  const globalCommands = commands.filter((c) => c.scope === "global");

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.habitat_nav_commands()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.habitat_commands_desc()}</p>

      {conversationCommands.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">{m.habitat_commands_conversation_scope()}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            {m.habitat_commands_conversation_hint({
              count: String(conversationCommands.length),
            })}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{m.habitat_commands_command()}</TableHead>
                  <TableHead>{m.habitat_commands_description()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversationCommands.map((cmd) => (
                  <TableRow key={cmd.name}>
                    <TableCell className="font-mono text-sm">/{cmd.name}</TableCell>
                    <TableCell>
                      <CommandDescription cmd={cmd} />
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
          <h3 className="text-sm font-semibold mb-2">{m.habitat_commands_global_scope()}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            {m.habitat_commands_global_hint({ count: String(globalCommands.length) })}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{m.habitat_commands_command()}</TableHead>
                  <TableHead>{m.habitat_commands_description()}</TableHead>
                  <TableHead className="w-40">{m.habitat_commands_platform()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalCommands.map((cmd) => (
                  <TableRow key={cmd.name}>
                    <TableCell className="font-mono text-sm">/{cmd.name}</TableCell>
                    <TableCell>
                      <CommandDescription cmd={cmd} />
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
        <StatusAlert variant="info">{m.habitat_commands_empty()}</StatusAlert>
      ) : null}
    </div>
  );
}
