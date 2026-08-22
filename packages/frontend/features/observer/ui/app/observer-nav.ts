/** 卧室子模块：统一 Anima 上下文下的私有空间页面。 */
export type ObserverNavItem = {
  to: string;
  label: string;
};

export type ObserverNavGroup = {
  id: string;
  label: string;
  items: ObserverNavItem[];
};

export function observerNavGroups(): ObserverNavGroup[] {
  return [
    {
      id: "cognition",
      label: "认知",
      items: [
        { to: "/self-layer", label: "自我层" },
        { to: "/semantic-memory", label: "语义记忆" },
        { to: "/temporal-summary", label: "时间摘要" },
        { to: "/system-prompt", label: "系统提示词" },
        { to: "/maintenance", label: "维护" },
      ],
    },
    {
      id: "life",
      label: "生活记录",
      items: [
        { to: "/diary", label: "日记" },
        { to: "/note", label: "笔记" },
        { to: "/email", label: "邮件" },
        { to: "/vault", label: "密码库" },
        { to: "/bookmarks", label: "书签" },
      ],
    },
    {
      id: "workspace",
      label: "事务",
      items: [
        { to: "/tasks", label: "清单" },
        { to: "/projects", label: "项目" },
        { to: "/calendar", label: "日程" },
        { to: "/entities", label: "实体" },
        { to: "/notifications", label: "通知" },
      ],
    },
  ];
}

export function observerNavItems(): ObserverNavItem[] {
  return observerNavGroups().flatMap((g) => g.items);
}
