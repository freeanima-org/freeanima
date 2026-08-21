import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { ListDetailLayout } from "@freeanima/ui-kit/layout";
import { setPortalSubjectIdOverride } from "@freeanima/client/portal-sdk/portal-subject-override.ts";
import {
  ObserverAgentProvider,
  ObserverAgentSelect,
  useObserverAgentSubjectId,
} from "@freeanima/features/observer/ui/lib/observer-agent.tsx";
import { observerNavGroups, observerNavItems } from "./observer-nav.ts";

function ObserverSidebarNav() {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-1 pb-3">
      <div className="border-b px-2 pb-3 pt-2">
        <ObserverAgentSelect className="w-full flex-col items-stretch [&>span]:text-xs" />
      </div>
      {observerNavGroups().map((group) => (
        <div key={group.id}>
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="session-item"
                activeProps={{ className: "session-item sidebar-nav-active" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** 生活记录等复用产品 SPA：把卧室所选 Anima 注入 portal subject（含 getUserSubjectId）。 */
function BedroomSubjectBridge({ children }: { children: ReactNode }) {
  const agentSubjectId = useObserverAgentSubjectId();

  useEffect(() => {
    setPortalSubjectIdOverride(agentSubjectId);
    return () => setPortalSubjectIdOverride(null);
  }, [agentSubjectId]);

  return children;
}

function BedroomOutlet() {
  const agentSubjectId = useObserverAgentSubjectId();
  // 切换 Anima 时整页 remount，避免日记/笔记等残留上一主体的本地态
  return <Outlet key={agentSubjectId ?? "pending"} />;
}

export function ObserverLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerTitle = useMemo(() => {
    const active = observerNavItems()
      .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
      .toSorted((a, b) => b.to.length - a.to.length)[0];
    return active?.label ?? "卧室";
  }, [pathname]);

  return (
    <ObserverAgentProvider>
      <BedroomSubjectBridge>
        <div
          data-testid="bedroom-layout"
          className="flex h-full min-h-0 flex-col overflow-x-hidden"
        >
          <div className="min-h-0 flex-1">
            <ListDetailLayout
              className="console-app"
              detailTitle={headerTitle}
              listTitle="卧室"
              showListHeader={false}
              showDetailHeader={false}
              listWidthClass="w-64"
              listAsideClassName="border bg-background"
              listHeaderClassName="p-3 shrink-0"
              detailClassName="overflow-y-auto app-main-padding"
              listToggleAriaLabel="切换导航"
              list={() => <ObserverSidebarNav />}
            >
              <BedroomOutlet />
            </ListDetailLayout>
          </div>
        </div>
      </BedroomSubjectBridge>
    </ObserverAgentProvider>
  );
}
