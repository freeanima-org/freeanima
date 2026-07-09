import { m } from "./i18n.ts";

export type ConsoleNavItem = { to: string; label: string };

export type ConsoleNavGroup = {
  id: string;
  label: string;
  items: ConsoleNavItem[];
};

export function consoleNavGroups(): ConsoleNavGroup[] {
  return [
    {
      id: "runtime",
      label: m.console_nav_group_runtime(),
      items: [
        { to: "/dashboard", label: m.console_nav_dashboard() },
        { to: "/cron", label: m.console_nav_cron() },
      ],
    },
    {
      id: "memory",
      label: m.console_nav_group_memory(),
      items: [
        { to: "/memory", label: m.console_nav_memory() },
        { to: "/semantic-memory", label: m.console_nav_semantic() },
        { to: "/limbic-memory", label: m.console_nav_limbic() },
        { to: "/autobiographical-memory", label: m.console_nav_autobio() },
        { to: "/conversations", label: m.console_nav_conversations() },
        { to: "/fts", label: m.console_nav_fts() },
        { to: "/sleep", label: m.console_nav_sleep() },
        { to: "/auto-llm-runs", label: m.console_nav_auto_llm_runs() },
      ],
    },
    {
      id: "self",
      label: m.console_nav_group_self(),
      items: [
        { to: "/self-layer", label: m.console_nav_self_layer() },
        { to: "/system-prompt", label: m.console_nav_system_prompt() },
      ],
    },
    {
      id: "estate",
      label: m.console_nav_group_estate(),
      items: [
        { to: "/subjects", label: m.console_nav_subjects() },
        { to: "/worlds", label: m.console_nav_worlds() },
      ],
    },
    {
      id: "capabilities",
      label: m.console_nav_group_capabilities(),
      items: [
        { to: "/tools", label: m.console_nav_tools() },
        { to: "/commands", label: m.console_nav_commands() },
        { to: "/mcp", label: m.console_nav_mcp() },
        { to: "/acp", label: m.console_nav_acp() },
        { to: "/satellites", label: m.console_nav_satellites() },
      ],
    },
  ];
}

/** Flat list for route title lookup and backwards compatibility */
export function consoleNavItems(): ConsoleNavItem[] {
  return consoleNavGroups().flatMap((g) => g.items);
}
