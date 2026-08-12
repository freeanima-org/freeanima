import { lazyNamedComponent, shellLazyRoute } from "../lazy-route.tsx";
import { registerShellFeatureRoutes } from "./shell-registry.ts";
import { registerTaskEntityOverlay } from "@freeanima/features/task/ui/spa/register-task-entity-overlay.ts";
import { registerSemanticMemoryEntityOverlay } from "@freeanima/features/memory/ui/spa/register-semantic-memory-entity-overlay.ts";
import { registerCalendarEventEntityOverlay } from "@freeanima/features/calendar/ui/spa/register-calendar-entity-overlay.ts";

registerTaskEntityOverlay();
registerSemanticMemoryEntityOverlay();
registerCalendarEventEntityOverlay();

/** Shell routes for migrated feature plugins (Phase 2+). */
export function registerFeaturePluginShellRoutes(): void {
  registerShellFeatureRoutes([
    {
      featureId: "chat",
      path: "/chat",
      navLabel: "Chat",
      load: () =>
        import("@freeanima/features/chat/ui/spa").then(async (mod) => {
          await import("@freeanima/features/chat/ui/spa/styles.css");
          return { default: mod.ChatApp };
        }),
    },
    {
      featureId: "task",
      path: "/tasks",
      navLabel: "Tasks",
      load: lazyNamedComponent(() => import("@freeanima/features/task/ui/spa"), "TaskApp"),
    },
    {
      featureId: "project",
      path: "/projects",
      navLabel: "Projects",
      load: lazyNamedComponent(() => import("@freeanima/features/project/ui/spa"), "ProjectApp"),
    },
    {
      featureId: "calendar",
      path: "/calendar",
      navLabel: "Calendar",
      load: lazyNamedComponent(() => import("@freeanima/features/calendar/ui/spa"), "CalendarApp"),
    },
    {
      featureId: "pomodoro",
      path: "/pomodoro",
      navLabel: "Pomodoro",
      load: lazyNamedComponent(() => import("@freeanima/features/pomodoro/ui/spa"), "PomodoroApp"),
    },
    {
      featureId: "vault",
      path: "/vault",
      navLabel: "Vault",
      load: lazyNamedComponent(() => import("@freeanima/features/vault/ui/spa"), "VaultApp"),
    },
    {
      featureId: "entity",
      path: "/entity",
      navLabel: "Entity",
      load: lazyNamedComponent(() => import("@freeanima/features/entity/ui/spa"), "EntityApp"),
    },
    {
      featureId: "notification",
      path: "/notifications",
      navLabel: "Notifications",
      load: lazyNamedComponent(
        () => import("@freeanima/features/notification/ui/spa"),
        "NotificationApp",
      ),
    },
    {
      featureId: "diary",
      path: "/diary",
      navLabel: "Diary",
      load: lazyNamedComponent(() => import("@freeanima/features/diary/ui/spa"), "DiaryApp"),
    },
    {
      featureId: "email",
      path: "/email",
      navLabel: "Email",
      load: lazyNamedComponent(() => import("@freeanima/features/email/ui/spa"), "EmailApp"),
    },
  ]);
}

/** Habitat/admin SPA embedded in shell (formerly HabitatShell). */
export function loadHabitatShellRoute() {
  return shellLazyRoute(
    () =>
      import("@freeanima/features/habitat/ui/spa").then(async (mod) => {
        await import("@freeanima/features/habitat/ui/habitat/styles.css");
        return { default: mod.HabitatShell as import("react").ComponentType<object> };
      }) as Promise<{ default: import("react").ComponentType<object> }>,
  );
}

registerFeaturePluginShellRoutes();
