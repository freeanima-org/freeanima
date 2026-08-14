export type HabitatNavItem = { to: string; label: string };

export type HabitatNavGroup = {
  id: string;
  label: string;
  items: HabitatNavItem[];
};

export function habitatNavGroups(): HabitatNavGroup[] {
  return [
    {
      id: "runtime",
      label: "运行时",
      items: [
        { to: "/dashboard", label: "📊 仪表盘" },
        { to: "/cron", label: "⏰ 定时任务" },
      ],
    },
    {
      id: "memory",
      label: "记忆体系",
      items: [
        { to: "/semantic-memory", label: "📝 语义记忆" },
        { to: "/temporal-summary", label: "⏳ 时间摘要" },
        { to: "/conversations", label: "💬 对话" },
        { to: "/auto-llm-runs", label: "🤖 自动 LLM 运行" },
      ],
    },
    {
      id: "self",
      label: "自我",
      items: [
        { to: "/self-layer", label: "🪞 自我层" },
        { to: "/system-prompt", label: "📋 系统提示词" },
      ],
    },
    {
      id: "estate",
      label: "资源",
      items: [
        { to: "/subjects", label: "👤 主体" },
        { to: "/worlds", label: "🌍 世界" },
        { to: "/data-maintenance", label: "🧰 数据维护" },
      ],
    },
    {
      id: "capabilities",
      label: "能力",
      items: [
        { to: "/tools", label: "🔧 工具" },
        { to: "/skills", label: "🧩 技能" },
        { to: "/commands", label: "⌨️ 命令" },
        { to: "/mcp", label: "🔌 MCP" },
        { to: "/subagents", label: "🦾 子代理" },
        { to: "/outposts", label: "📡 前哨" },
      ],
    },
  ];
}

/** Flat list for route title lookup and backwards compatibility */
export function habitatNavItems(): HabitatNavItem[] {
  return habitatNavGroups().flatMap((g) => g.items);
}
