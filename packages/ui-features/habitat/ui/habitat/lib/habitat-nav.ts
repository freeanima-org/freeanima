export type HabitatNavItem = {
  label: string;
  /** Habitat 内路由（TanStack Link） */
  to?: string;
};

export type HabitatNavGroup = {
  id: string;
  label: string;
  items: HabitatNavItem[];
};

/** 栖息地侧栏：运维 / 资源 / 能力（Anima 私有空间已迁顶级「卧室」/bedroom）。 */
export function habitatNavGroups(): HabitatNavGroup[] {
  return [
    {
      id: "runtime",
      label: "运行时",
      items: [
        { to: "/dashboard", label: "仪表盘" },
        { to: "/cron", label: "定时任务" },
      ],
    },
    {
      id: "conversation-ops",
      label: "对话运维",
      items: [
        { to: "/conversations", label: "对话" },
        { to: "/conversation-shares", label: "临时分享" },
        { to: "/auto-llm-runs", label: "自动 LLM 运行" },
      ],
    },
    {
      id: "estate",
      label: "资源",
      items: [
        { to: "/subjects", label: "主体" },
        { to: "/worlds", label: "世界" },
        { to: "/data-maintenance", label: "数据维护" },
      ],
    },
    {
      id: "capabilities",
      label: "能力",
      items: [
        { to: "/tools", label: "工具" },
        { to: "/skills", label: "技能" },
        { to: "/commands", label: "命令" },
        { to: "/mcp", label: "MCP" },
        { to: "/subagents", label: "子代理" },
        { to: "/outposts", label: "前哨" },
      ],
    },
  ];
}

/** Flat list for route title lookup and backwards compatibility */
export function habitatNavItems(): HabitatNavItem[] {
  return habitatNavGroups().flatMap((g) => g.items);
}

/** 产品模块 href：尊重 Vite 壳 base（`/web` 或桌面根路径）。 */
export function shellProductHref(productPath: string): string {
  const path = productPath.startsWith("/") ? productPath : `/${productPath}`;
  const raw = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  const basepath = raw && raw !== "." && raw.startsWith("/") ? raw : "";
  return `${basepath}${path}`;
}
