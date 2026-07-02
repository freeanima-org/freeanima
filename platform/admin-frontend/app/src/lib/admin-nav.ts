import { m } from "./i18n.ts";

export type AdminNavItem = { to: string; label: string };

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export function adminNavGroups(): AdminNavGroup[] {
  return [
    {
      id: "runtime",
      label: m.admin_nav_group_runtime(),
      items: [
        { to: "/dashboard", label: m.admin_nav_dashboard() },
        { to: "/config", label: m.admin_nav_config() },
        { to: "/cron", label: m.admin_nav_cron() },
      ],
    },
    {
      id: "memory",
      label: m.admin_nav_group_memory(),
      items: [
        { to: "/memory", label: m.admin_nav_memory() },
        { to: "/semantic-memory", label: m.admin_nav_semantic() },
        { to: "/limbic-memory", label: m.admin_nav_limbic() },
        { to: "/autobiographical-memory", label: m.admin_nav_autobio() },
        { to: "/conversations", label: m.admin_nav_conversations() },
        { to: "/fts", label: m.admin_nav_fts() },
        { to: "/sleep", label: m.admin_nav_sleep() },
        { to: "/auto-llm-runs", label: m.admin_nav_auto_llm_runs() },
      ],
    },
    {
      id: "self",
      label: m.admin_nav_group_self(),
      items: [
        { to: "/self-layer", label: m.admin_nav_self_layer() },
        { to: "/system-prompt", label: m.admin_nav_system_prompt() },
      ],
    },
    {
      id: "estate",
      label: m.admin_nav_group_estate(),
      items: [
        { to: "/subjects", label: m.admin_nav_subjects() },
        { to: "/worlds", label: m.admin_nav_worlds() },
      ],
    },
    {
      id: "capabilities",
      label: m.admin_nav_group_capabilities(),
      items: [
        { to: "/tools", label: m.admin_nav_tools() },
        { to: "/commands", label: m.admin_nav_commands() },
        { to: "/mcp", label: m.admin_nav_mcp() },
        { to: "/acp", label: m.admin_nav_acp() },
        { to: "/satellites", label: m.admin_nav_satellites() },
      ],
    },
  ];
}

/** Flat list for route title lookup and backwards compatibility */
export function adminNavItems(): AdminNavItem[] {
  return adminNavGroups().flatMap((g) => g.items);
}
