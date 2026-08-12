import { createFileRoute } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { listConversationCommands } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
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
  if (!platforms?.length) return "全部";
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
      <h2 className="text-lg font-bold mb-1">{"⌨️ 命令"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {"在对话输入框以 / 开头即可触发。命令按作用域分为两类。"}
      </p>

      {conversationCommands.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">{"当前会话"}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            {`所有平台默认可用（共 ${String(conversationCommands.length)} 个）。`}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{"命令"}</TableHead>
                  <TableHead>{"说明"}</TableHead>
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
          <h3 className="text-sm font-semibold mb-2">{"其它"}</h3>
          <p className="text-xs text-muted-foreground mb-2">
            {`跨对话或平台级操作（共 ${String(globalCommands.length)} 个）。`}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{"命令"}</TableHead>
                  <TableHead>{"说明"}</TableHead>
                  <TableHead className="w-40">{"平台"}</TableHead>
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
        <StatusAlert variant="info">{"暂无已注册的 slash 命令。"}</StatusAlert>
      ) : null}
    </div>
  );
}
