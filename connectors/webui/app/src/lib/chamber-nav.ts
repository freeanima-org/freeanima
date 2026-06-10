import { m } from "./i18n.ts";

export function chamberNavItems(): { to: string; label: string }[] {
  return [
    { to: "/chamber/dashboard", label: m.webui_chamber_nav_dashboard() },
    { to: "/chamber/sessions", label: m.webui_chamber_nav_sessions() },
    { to: "/chamber/tasks", label: m.webui_chamber_nav_tasks() },
    { to: "/chamber/fridge", label: m.webui_chamber_nav_fridge() },
    { to: "/chamber/memory", label: m.webui_chamber_nav_memory() },
    { to: "/chamber/semantic-memory", label: m.webui_chamber_nav_semantic() },
    { to: "/chamber/fts", label: m.webui_chamber_nav_fts() },
    { to: "/chamber/limbic-memory", label: m.webui_chamber_nav_limbic() },
    { to: "/chamber/autobiographical-memory", label: m.webui_chamber_nav_autobio() },
    { to: "/chamber/self-layer", label: m.webui_chamber_nav_self_layer() },
    { to: "/chamber/system-prompt", label: m.webui_chamber_nav_system_prompt() },
    { to: "/chamber/config", label: m.webui_chamber_nav_config() },
    { to: "/chamber/tools", label: m.webui_chamber_nav_tools() },
    { to: "/chamber/commands", label: m.webui_chamber_nav_commands() },
    { to: "/chamber/mcp", label: m.webui_chamber_nav_mcp() },
    { to: "/chamber/acp", label: m.webui_chamber_nav_acp() },
    { to: "/chamber/credentials", label: m.webui_chamber_nav_credentials() },
    { to: "/chamber/cron", label: m.webui_chamber_nav_cron() },
    { to: "/chamber/sleep", label: m.webui_chamber_nav_sleep() },
    { to: "/chamber/email", label: m.webui_chamber_nav_email() },
  ];
}
