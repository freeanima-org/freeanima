import {
  Outlet,
  createRootRoute,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return <AppShell />;
}

type AppMode = "parlor" | "chamber" | "studio";

function resolveMode(pathname: string): AppMode {
  if (pathname.startsWith("/chamber") || pathname.startsWith("/workshop")) return "chamber";
  if (pathname.startsWith("/studio")) return "studio";
  return "parlor";
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const mode = resolveMode(pathname);

  const switchMode = (target: AppMode) => {
    if (target === "parlor") {
      if (!pathname.startsWith("/parlor")) navigate({ to: "/parlor/chat", search: { session: undefined } });
    } else if (target === "chamber") {
      if (!pathname.startsWith("/chamber") && !pathname.startsWith("/workshop")) {
        navigate({ to: "/chamber/dashboard" });
      }
    } else if (!pathname.startsWith("/studio")) {
      navigate({ to: "/studio/pair-programming" });
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="app-header shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:px-4 sm:py-0 sm:h-10 sm:flex-nowrap border-b border-base-300 bg-base-200">
        <span className="text-sm font-medium text-base-content/70 shrink-0">逸灵风</span>
        <div className="flex gap-1 sm:gap-2 w-full sm:w-auto">
          <button
            type="button"
            className={`btn btn-xs flex-1 sm:flex-none min-w-0 ${mode === "parlor" ? "btn-primary" : "btn-ghost"}`}
            title="Parlor"
            onClick={() => switchMode("parlor")}
          >
            会客厅
          </button>
          <button
            type="button"
            className={`btn btn-xs flex-1 sm:flex-none min-w-0 ${mode === "chamber" ? "btn-primary" : "btn-ghost"}`}
            title="Chamber"
            onClick={() => switchMode("chamber")}
          >
            卧室
          </button>
          <button
            type="button"
            className={`btn btn-xs flex-1 sm:flex-none min-w-0 ${mode === "studio" ? "btn-primary" : "btn-ghost"}`}
            title="Studio"
            onClick={() => switchMode("studio")}
          >
            创作室
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
