import { lazyNamedComponent, shellLazyRoute } from "../lazy-route.tsx";
import { registerShellFeatureRoutes } from "./shell-registry.ts";

/** Shell routes for migrated feature plugins (Phase 2+). */
export function registerFeaturePluginShellRoutes(): void {
  registerShellFeatureRoutes([
    {
      featureId: "chat",
      path: "/chat",
      navLabel: "Chat",
      load: () =>
        import("@freeanima/feature-chat/ui/spa").then(async (mod) => {
          await import("@freeanima/feature-chat/ui/spa/styles.css");
          return { default: mod.ChatApp };
        }),
    },
    {
      featureId: "task",
      path: "/tasks",
      navLabel: "Tasks",
      load: lazyNamedComponent(() => import("@freeanima/feature-task/ui/spa"), "TaskApp"),
    },
    {
      featureId: "vault",
      path: "/vault",
      navLabel: "Vault",
      load: lazyNamedComponent(() => import("@freeanima/feature-vault/ui/spa"), "VaultApp"),
    },
    {
      featureId: "notification",
      path: "/notifications",
      navLabel: "Notifications",
      load: lazyNamedComponent(
        () => import("@freeanima/feature-notification/ui/spa"),
        "NotificationApp",
      ),
    },
    {
      featureId: "diary",
      path: "/diary",
      navLabel: "Diary",
      load: lazyNamedComponent(() => import("@freeanima/feature-diary/ui/spa"), "DiaryApp"),
    },
    {
      featureId: "dream",
      path: "/dream",
      navLabel: "Dream",
      load: lazyNamedComponent(() => import("@freeanima/feature-dream/ui/spa"), "DreamApp"),
    },
    {
      featureId: "email",
      path: "/email",
      navLabel: "Email",
      load: lazyNamedComponent(() => import("@freeanima/feature-email/ui/spa"), "EmailApp"),
    },
  ]);
}

/** Console/admin SPA embedded in shell (formerly ConsoleShell). */
export function loadConsoleShellRoute() {
  return shellLazyRoute(() =>
    import("@freeanima/feature-console/ui/spa").then(async (mod) => {
      await import("@freeanima/feature-console/ui/console/styles.css");
      return { default: mod.ConsoleShell };
    }),
  );
}

registerFeaturePluginShellRoutes();
