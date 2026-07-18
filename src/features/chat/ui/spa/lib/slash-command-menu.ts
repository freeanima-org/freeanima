/** Slash command metadata used by Chat autocomplete. */
export type SlashCommandItem = {
  name: string;
  description?: string;
  subcommands?: { name: string; description: string }[];
};

/** One row in the slash autocomplete menu. */
export type SlashMenuEntry = {
  /** Text inserted on select, always ends with a trailing space. */
  insertText: string;
  /** Left column label, e.g. `/goal` or `/goal status`. */
  label: string;
  description?: string;
};

/**
 * Build autocomplete rows for the current input.
 *
 * - `/go` → top-level commands matching prefix
 * - `/goal` or `/goal ` or `/goal st` → that command's subcommands (if any)
 * - third token onwards (e.g. `/subgoal remove 1`) → empty (free-form args)
 */
export function buildSlashMenuEntries(
  inputText: string,
  commands: SlashCommandItem[],
): SlashMenuEntry[] {
  if (!inputText.startsWith("/")) return [];
  const body = inputText.slice(1);
  // Trailing space still counts as starting the next token for filtering.
  const parts = body.split(/\s+/);
  const hasTrailingSpace = body.length > 0 && /\s$/.test(body);
  const tokenCount = parts.filter(Boolean).length + (hasTrailingSpace ? 1 : 0);

  // `/` alone or still typing the command name (no completed first token + space)
  if (!body.includes(" ")) {
    const prefix = body.toLowerCase();
    return commands
      .filter((c) => c.name.toLowerCase().startsWith(prefix))
      .map((c) => ({
        insertText: `/${c.name} `,
        label: `/${c.name}`,
        ...(c.description ? { description: c.description } : {}),
      }));
  }

  const cmdName = parts[0]?.toLowerCase();
  if (!cmdName) return [];

  // Third segment started → user is typing free-form args after a subcommand.
  if (tokenCount > 2) return [];

  const cmd = commands.find((c) => c.name.toLowerCase() === cmdName);
  const subs = cmd?.subcommands;
  if (!cmd || !subs?.length) return [];

  const subPrefix = (hasTrailingSpace ? "" : (parts[1] ?? "")).toLowerCase();
  return subs
    .filter((s) => s.name.toLowerCase().startsWith(subPrefix))
    .map((s) => ({
      insertText: `/${cmd.name} ${s.name} `,
      label: `/${cmd.name} ${s.name}`,
      description: s.description,
    }));
}
