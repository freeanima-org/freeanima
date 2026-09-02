import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SubjectScopeProvider } from "@freeanima/client/portal-sdk/react.tsx";
import {
  resolveDefaultVisibleModulePath,
  resolveShellModuleIdFromPath,
} from "@freeanima/client/portal-sdk/shell-module-visibility";
import {
  useCompactImmersive,
  useShellModuleVisibility,
  useShellModuleOrder,
  useShellModulePrimaryCount,
} from "@freeanima/client/portal-sdk/react.tsx";

import { isCompactLayout, useLayoutMode } from "../layout-mode.ts";
import { navigateAppModule } from "../app-nav.ts";
import { orderedVisibleAppNavItems, type AppNavItem } from "../lib/app-nav-i18n.ts";
import { useAppBottomNavLayout } from "../lib/use-app-bottom-nav-layout.ts";
import { AppModuleRail } from "./AppModuleRail.tsx";
import { PomodoroShellWatcher } from "@freeanima/features/pomodoro/ui/spa/PomodoroShellWatcher.tsx";
import { ChatUnreadShellWatcher } from "@freeanima/features/chat/ui/spa/ChatUnreadShellWatcher.tsx";
import { SpeechShellWatcher } from "@freeanima/features/chat/ui/spa/SpeechShellWatcher.tsx";
import { VoiceAssistantShellWatcher } from "@freeanima/features/voice-assistant/ui/spa/VoiceAssistantShellWatcher.tsx";
import { NotificationReminderShellWatcher } from "@freeanima/features/notification/ui/spa/NotificationReminderShellWatcher.tsx";
import { TaskAdvanceReminderShellWatcher } from "@freeanima/features/task/ui/spa/TaskAdvanceReminderShellWatcher.tsx";
import { AppAttentionShellWatcher } from "./AppAttentionShellWatcher.tsx";
import { AppNavUnreadBadge } from "./AppNavUnreadBadge.tsx";
import {
  AppNavPomodoroMoreLabel,
  useAppNavPomodoroDisplayLabel,
} from "./AppNavPomodoroCountdown.tsx";
import { ShellQuickMoreSection } from "./ShellQuickNav.tsx";
import { useShellQuickEntries } from "@freeanima/client/portal-sdk/react.tsx";

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function AppModuleVisibilityGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const visible = useShellModuleVisibility();
  const order = useShellModuleOrder();

  useEffect(() => {
    const moduleId = resolveShellModuleIdFromPath(pathname);
    if (!moduleId || visible.has(moduleId)) return;
    navigateAppModule(navigate, resolveDefaultVisibleModulePath(visible, order));
  }, [navigate, order, pathname, visible]);

  return null;
}

function AppBottomNavLink({ item, density }: { item: AppNavItem; density: "label" | "icon" }) {
  const active = useNavActive(item.match);
  const Icon = item.icon;
  const fallback = item.label();
  const { label, ariaLabel } = useAppNavPomodoroDisplayLabel(item.id, fallback, "compact");

  return (
    <Link
      to={item.to}
      className={`app-bottom-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 min-h-12 min-w-0 rounded-md text-xs transition-colors ${
        active
          ? "bg-secondary text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative inline-flex">
        <Icon className="size-5 shrink-0" aria-hidden />
        <AppNavUnreadBadge moduleId={item.id} />
      </span>
      {density === "label" ? (
        <span className="leading-none truncate max-w-full px-0.5 tabular-nums">{label}</span>
      ) : label !== fallback ? (
        <span className="leading-none truncate max-w-full px-0.5 tabular-nums text-[10px]">
          {label}
        </span>
      ) : null}
    </Link>
  );
}

function MoreNavMenu({ items }: { items: AppNavItem[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const quickEntries = useShellQuickEntries();
  const moreActive = useMemo(
    () => items.some((item) => pathname.startsWith(item.match)),
    [items, pathname],
  );

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center min-h-12">
      <button
        type="button"
        className={`app-bottom-nav-item flex flex-col items-center justify-center gap-0.5 rounded-md text-xs transition-colors ${
          moreActive || open
            ? "bg-secondary text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="leading-none">更多</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[65] cursor-default bg-transparent"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="fixed z-[70] min-w-40 max-h-[70vh] overflow-y-auto rounded-lg border border bg-background shadow-lg py-1"
            style={{
              right: "max(0.75rem, var(--sar))",
              bottom: "calc(var(--app-bottom-nav-h) + var(--sab) + 0.5rem)",
            }}
          >
            <ShellQuickMoreSection onNavigate={() => setOpen(false)} />
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigateAppModule(navigate, item.to);
                    setOpen(false);
                  }}
                >
                  <span className="relative inline-flex">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <AppNavUnreadBadge moduleId={item.id} />
                  </span>
                  <AppNavPomodoroMoreLabel moduleId={item.id} fallback={item.label()} />
                </button>
              );
            })}
            {items.length === 0 && quickEntries.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">暂无更多</div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ExpandedAppFrame() {
  return (
    <div className="app-module-layout h-full flex flex-row bg-background text-foreground">
      <AppModuleRail />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CompactAppFrame() {
  const visible = useShellModuleVisibility();
  const order = useShellModuleOrder();
  const primaryCount = useShellModulePrimaryCount();
  const immersive = useCompactImmersive();
  const navItems = useMemo(() => orderedVisibleAppNavItems(visible, order), [order, visible]);
  const { bar, more, density } = useAppBottomNavLayout(navItems, primaryCount);
  const quickEntries = useShellQuickEntries();
  const showMore = more.length > 0 || quickEntries.length > 0;

  return (
    <div className="app-module-layout app-layout-compact h-full flex flex-col bg-background text-foreground">
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
      {immersive ? null : (
        <nav
          className="app-bottom-nav relative z-[60] shrink-0 flex border-t border bg-background safe-area-pb"
          aria-label="模块导航"
        >
          {bar.map((item) => (
            <AppBottomNavLink key={item.to} item={item} density={density} />
          ))}
          {showMore ? <MoreNavMenu items={more} /> : null}
        </nav>
      )}
    </div>
  );
}

export function AppFrame() {
  const layoutMode = useLayoutMode();
  return (
    <SubjectScopeProvider>
      <AppModuleVisibilityGuard />
      <PomodoroShellWatcher />
      <ChatUnreadShellWatcher />
      <SpeechShellWatcher />
      <VoiceAssistantShellWatcher />
      <NotificationReminderShellWatcher />
      <TaskAdvanceReminderShellWatcher />
      <AppAttentionShellWatcher />
      {isCompactLayout(layoutMode) ? <CompactAppFrame /> : <ExpandedAppFrame />}
    </SubjectScopeProvider>
  );
}
