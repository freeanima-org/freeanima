import * as m from "../../../../../messages/paraglide/messages.js";

export type ShellNavItem = {
  to: string;
  match: string;
  label: () => string;
};

/** Desktop top bar — all primary modules */
export function shellNavItems(): ShellNavItem[] {
  return [
    { to: "/chat", match: "/chat", label: () => m.admin_nav_chat() },
    { to: "/tasks", match: "/tasks", label: () => m.admin_nav_tasks() },
    { to: "/email", match: "/email", label: () => m.admin_nav_email() },
    { to: "/diary", match: "/diary", label: () => m.admin_nav_diary() },
    { to: "/vault", match: "/vault", label: () => m.admin_nav_vault() },
    { to: "/dream", match: "/dream", label: () => m.admin_nav_dream() },
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

/** Mobile bottom bar — core modules (admin/settings via More) */
export function shellMobilePrimaryNavItems(): ShellNavItem[] {
  return [
    { to: "/chat", match: "/chat", label: () => m.admin_nav_chat() },
    { to: "/tasks", match: "/tasks", label: () => m.admin_nav_tasks() },
    { to: "/email", match: "/email", label: () => m.admin_nav_email() },
    { to: "/diary", match: "/diary", label: () => m.admin_nav_diary() },
    { to: "/dream", match: "/dream", label: () => m.admin_nav_dream() },
    {
      to: "/notifications",
      match: "/notifications",
      label: () => m.admin_nav_notifications(),
    },
  ];
}

/** Mobile More menu — secondary modules */
export function shellMobileMoreNavItems(): ShellNavItem[] {
  return [
    { to: "/vault", match: "/vault", label: () => m.admin_nav_vault() },
    { to: "/admin/dashboard", match: "/admin", label: () => m.admin_nav_dashboard() },
    { to: "/settings", match: "/settings", label: () => m.admin_nav_settings() },
  ];
}
