import { m } from "./i18n.ts";

export type HabitatNavItem = { to: string; label: string };

export type HabitatNavGroup = {
  id: string;
  label: string;
  items: HabitatNavItem[];
};

export function habitatNavGroups(): HabitatNavGroup[] {
  return [
    {
      id: "runtime",
      label: m.habitat_nav_group_runtime(),
      items: [
        { to: "/dashboard", label: m.habitat_nav_dashboard() },
        { to: "/cron", label: m.habitat_nav_cron() },
      ],
    },
    {
      id: "memory",
      label: m.habitat_nav_group_memory(),
      items: [
        { to: "/memory", label: m.habitat_nav_memory() },
        { to: "/semantic-memory", label: m.habitat_nav_semantic() },
        { to: "/limbic-memory", label: m.habitat_nav_limbic() },
        { to: "/autobiographical-memory", label: m.habitat_nav_autobio() },
        { to: "/conversations", label: m.habitat_nav_conversations() },
        { to: "/fts", label: m.habitat_nav_fts() },
        { to: "/sleep", label: m.habitat_nav_sleep() },
        { to: "/auto-llm-runs", label: m.habitat_nav_auto_llm_runs() },
      ],
    },
    {
      id: "self",
      label: m.habitat_nav_group_self(),
      items: [
        { to: "/self-layer", label: m.habitat_nav_self_layer() },
        { to: "/system-prompt", label: m.habitat_nav_system_prompt() },
      ],
    },
    {
      id: "estate",
      label: m.habitat_nav_group_estate(),
      items: [
        { to: "/subjects", label: m.habitat_nav_subjects() },
        { to: "/worlds", label: m.habitat_nav_worlds() },
      ],
    },
    {
      id: "capabilities",
      label: m.habitat_nav_group_capabilities(),
      items: [
        { to: "/tools", label: m.habitat_nav_tools() },
        { to: "/skills", label: m.habitat_nav_skills() },
        { to: "/commands", label: m.habitat_nav_commands() },
        { to: "/mcp", label: m.habitat_nav_mcp() },
        { to: "/subagents", label: m.habitat_nav_subagents() },
        { to: "/outposts", label: m.habitat_nav_outposts() },
      ],
    },
  ];
}

/** Flat list for route title lookup and backwards compatibility */
export function habitatNavItems(): HabitatNavItem[] {
  return habitatNavGroups().flatMap((g) => g.items);
}
