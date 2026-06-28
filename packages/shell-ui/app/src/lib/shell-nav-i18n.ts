import * as m from "../../../../../messages/paraglide/messages.js";

export type ShellNavItem = {
  to: string;
  match: string;
  label: () => string;
};

export function shellNavItems(): ShellNavItem[] {
  return [
    { to: "/chat", match: "/chat", label: () => m.admin_nav_chat() },
    { to: "/tasks", match: "/tasks", label: () => m.admin_nav_tasks() },
    { to: "/email", match: "/email", label: () => m.admin_nav_email() },
    {
      to: "/notifications",
      match: "/notifications",
      label: () => m.admin_nav_notifications(),
    },
    { to: "/admin/dashboard", match: "/admin", label: () => m.admin_nav_dashboard() },
    {
      to: "/settings",
      match: "/settings",
      label: () => m.admin_nav_settings(),
    },
  ];
}
