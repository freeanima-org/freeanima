import { Link, useRouterState } from "@tanstack/react-router";
import { BrandLockup, BrandLogo, Button } from "@freeanima/ui-kit";
import { useShellModuleVisibility } from "@freeanima/shell-sdk/react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { filterVisibleNavItems, shellNavItems, type ShellNavItem } from "../lib/shell-nav-i18n.ts";
import {
  readShellRailExpanded,
  subscribeShellRailExpanded,
  writeShellRailExpanded,
} from "../lib/shell-rail-prefs.ts";
import * as shellMessages from "../../../../../messages/paraglide/messages.js";

function useShellRailExpanded(): [boolean, () => void] {
  const expanded = useSyncExternalStore(
    subscribeShellRailExpanded,
    readShellRailExpanded,
    () => false,
  );
  const toggle = useCallback(() => writeShellRailExpanded(!readShellRailExpanded()), []);
  return [expanded, toggle];
}

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function RailNavLink({ item, expanded }: { item: ShellNavItem; expanded: boolean }) {
  const active = useNavActive(item.match);
  const Icon = item.icon;
  const label = item.label();

  if (!expanded) {
    return (
      <Button
        asChild
        size="icon"
        variant={active ? "secondary" : "ghost"}
        className={active ? "relative" : undefined}
        title={label}
      >
        <Link to={item.to} aria-label={label} aria-current={active ? "page" : undefined}>
          <Icon className="size-5" aria-hidden />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant={active ? "secondary" : "ghost"}
      className={`w-full justify-start gap-2 ${active ? "relative" : ""}`}
    >
      <Link to={item.to} aria-current={active ? "page" : undefined}>
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  );
}

export function ShellModuleRail() {
  const [expanded, toggleExpanded] = useShellRailExpanded();
  const visible = useShellModuleVisibility();
  const nav = filterVisibleNavItems(shellNavItems(), visible);

  return (
    <aside
      className={`shell-module-rail flex shrink-0 flex-col gap-1 border-r border-border bg-muted py-2 transition-[width] duration-200 ${
        expanded
          ? "w-[var(--shell-rail-expanded-w)] items-stretch"
          : "w-[var(--shell-rail-w)] items-center"
      }`}
      aria-label="模块导航"
      data-expanded={expanded ? "true" : "false"}
    >
      <div
        className={`mb-2 flex shrink-0 items-center px-2 ${
          expanded ? "justify-start gap-2" : "justify-center px-1"
        }`}
      >
        {expanded ? (
          <BrandLockup
            name={shellMessages.console_brand()}
            logoSize={22}
            className="min-w-0 truncate"
          />
        ) : (
          <BrandLogo size={22} />
        )}
      </div>
      <nav
        className={`flex w-full min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto ${
          expanded ? "items-stretch px-2" : "items-center px-1"
        }`}
      >
        {nav.map((item) => (
          <RailNavLink key={item.to} item={item} expanded={expanded} />
        ))}
      </nav>
      <div className={`mt-auto shrink-0 ${expanded ? "px-2" : "px-1"}`}>
        <Button
          type="button"
          size={expanded ? "sm" : "icon"}
          variant="ghost"
          className={expanded ? "w-full justify-start gap-2" : undefined}
          aria-label={expanded ? "收起侧栏" : "展开侧栏"}
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          {expanded ? (
            <>
              <PanelLeftClose className="size-5 shrink-0" aria-hidden />
              <span className="truncate">收起</span>
            </>
          ) : (
            <PanelLeft className="size-5" aria-hidden />
          )}
        </Button>
      </div>
    </aside>
  );
}
