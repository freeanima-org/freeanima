import { omitUndefined } from "../lib/omit-undefined.ts";
import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ListDetailLayout } from "@freeanima/ui-kit/layout";

type ResponsiveSidebarLayoutProps = {
  title: ReactNode;
  /** 移动端顶栏标题（默认与聊天室一致：当前页名称） */
  headerTitle?: string;
  subtitle?: string;
  showSidebarHeader?: boolean;
  children: ReactNode;
  sidebar: (ctx: { close: () => void }) => ReactNode;
  mobileActions?: ReactNode;
};

export function ResponsiveSidebarLayout({
  title,
  headerTitle,
  subtitle,
  showSidebarHeader = true,
  children,
  sidebar,
  mobileActions,
}: ResponsiveSidebarLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const barTitle = headerTitle ?? title;

  return (
    <ListDetailLayout
      className="console-app"
      detailTitle={barTitle}
      listTitle={title}
      {...omitUndefined({ listSubtitle: subtitle })}
      showListHeader={showSidebarHeader}
      showDetailHeader={false}
      listWidthClass="w-64"
      listAsideClassName="border bg-background"
      listHeaderClassName="p-3 shrink-0"
      detailClassName="overflow-y-auto app-main-padding"
      listOpen={sidebarOpen}
      onListOpenChange={setSidebarOpen}
      listToggleAriaLabel={"切换导航"}
      detailActions={mobileActions}
      list={({ close }) => sidebar({ close })}
    >
      {children}
    </ListDetailLayout>
  );
}
