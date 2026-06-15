import { Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { getWebUiLocale, m, toggleWebUiLocale } from "@/lib/i18n.ts";

const PARLOR_SATELLITE_URL = "http://127.0.0.1:4174";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return <AppShell />;
}

type AppMode = "parlor" | "chamber";

function resolveMode(pathname: string): AppMode {
  if (pathname.startsWith("/chamber") || pathname.startsWith("/workshop")) return "chamber";
  return "chamber";
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const mode = resolveMode(pathname);
  const [, setLocaleTick] = useState(0);

  const switchMode = (target: AppMode) => {
    if (target === "parlor") {
      window.open(PARLOR_SATELLITE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    if (target === "chamber") {
      if (!pathname.startsWith("/chamber") && !pathname.startsWith("/workshop")) {
        navigate({ to: "/chamber/dashboard" });
      }
    }
  };

  const toggleLocale = () => {
    toggleWebUiLocale();
    setLocaleTick((n) => n + 1);
  };

  const locale = getWebUiLocale();

  return (
    <div className="h-screen flex flex-col">
      <header className="app-header shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:px-4 sm:py-0 sm:h-10 sm:flex-nowrap border-b border-base-300 bg-base-200">
        <span className="text-sm font-medium text-base-content/70 shrink-0">{m.webui_brand()}</span>
        <div className="flex gap-1 sm:gap-2 w-full sm:w-auto items-center">
          <button
            type="button"
            className={`btn btn-xs flex-1 sm:flex-none min-w-0 ${mode === "parlor" ? "btn-primary" : "btn-ghost"}`}
            title={m.webui_mode_parlor()}
            onClick={() => switchMode("parlor")}
          >
            {m.webui_mode_parlor()}
          </button>
          <button
            type="button"
            className={`btn btn-xs flex-1 sm:flex-none min-w-0 ${mode === "chamber" ? "btn-primary" : "btn-ghost"}`}
            title={m.webui_mode_chamber()}
            onClick={() => switchMode("chamber")}
          >
            {m.webui_mode_chamber()}
          </button>
          <button type="button" className="btn btn-xs btn-ghost" onClick={toggleLocale}>
            {locale === "zh-cn" ? m.webui_nav_language_en() : m.webui_nav_language_zh()}
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
