import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout.tsx";

const navItems = [
  { to: "/chamber/dashboard", label: "📊 仪表盘" },
  { to: "/chamber/sessions", label: "💬 会话列表" },
  { to: "/chamber/memory", label: "🧠 记忆台" },
  { to: "/chamber/config", label: "⚙️ 配置" },
  { to: "/chamber/tools", label: "🔧 工具" },
  { to: "/chamber/commands", label: "⌨️ 命令" },
  { to: "/chamber/mcp", label: "🔌 MCP" },
  { to: "/chamber/acp", label: "🤝 ACP" },
  { to: "/chamber/credentials", label: "🔐 凭证" },
  { to: "/chamber/cron", label: "⏰ 定时任务" },
  { to: "/chamber/email", label: "📧 邮件" },
] as const;

export const Route = createFileRoute("/chamber")({
  component: ChamberLayout,
});

function ChamberLayout() {
  return (
    <div data-testid="chamber-layout" className="h-full min-h-0">
      <ResponsiveSidebarLayout
        title="卧室"
        subtitle="Chamber"
        sidebar={() => (
          <nav className="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="nav-link"
                activeProps={{ className: "nav-link sidebar-nav-active" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      >
        <Outlet />
      </ResponsiveSidebarLayout>
    </div>
  );
}
