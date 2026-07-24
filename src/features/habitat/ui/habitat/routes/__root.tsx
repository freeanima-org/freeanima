import { Outlet, createRootRoute } from "@tanstack/react-router";
import { BrandLockup } from "@freeanima/frontend/ui-kit";

import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return <AppShell />;
}

function isEmbeddedShell(): boolean {
  if (new URLSearchParams(window.location.search).get("embed") === "1") return true;
  return document.documentElement.dataset.appUi === "1";
}

function AppShell() {
  const embedded = isEmbeddedShell();

  return (
    <div
      className={[
        "h-full min-h-0 flex flex-col overflow-x-hidden",
        embedded ? "" : "safe-area-pt safe-area-px",
      ].join(" ")}
    >
      {embedded ? null : (
        <header className="app-header shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:px-4 sm:py-0 sm:h-10 sm:flex-nowrap border-b border bg-muted">
          <BrandLockup name={m.habitat_brand()} logoSize={20} />
        </header>
      )}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
