import { m } from "./i18n.ts";

export function adminNavItems(): { to: string; label: string }[] {
  return [
    { to: "/dashboard", label: m.admin_nav_dashboard() },
    { to: "/conversations", label: m.admin_nav_conversations() },
    { to: "/tasks", label: m.admin_nav_tasks() },
    { to: "/fridge-magnet", label: m.admin_nav_fridge() },
    { to: "/memory", label: m.admin_nav_memory() },
    { to: "/semantic-memory", label: m.admin_nav_semantic() },
    { to: "/fts", label: m.admin_nav_fts() },
    { to: "/limbic-memory", label: m.admin_nav_limbic() },
    { to: "/dream", label: m.admin_nav_dream() },
    { to: "/autobiographical-memory", label: m.admin_nav_autobio() },
    { to: "/self-layer", label: m.admin_nav_self_layer() },
    { to: "/system-prompt", label: m.admin_nav_system_prompt() },
    { to: "/tools", label: m.admin_nav_tools() },
    { to: "/commands", label: m.admin_nav_commands() },
    { to: "/mcp", label: m.admin_nav_mcp() },
    { to: "/satellites", label: m.admin_nav_satellites() },
    { to: "/acp", label: m.admin_nav_acp() },
    { to: "/cron", label: m.admin_nav_cron() },
    { to: "/auto-llm-runs", label: m.admin_nav_auto_llm_runs() },
    { to: "/sleep", label: m.admin_nav_sleep() },
    { to: "/email", label: m.admin_nav_email() },
  ];
}
