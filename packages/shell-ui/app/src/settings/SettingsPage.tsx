import { Link } from "@tanstack/react-router";

import { detectPlatform } from "../platform.ts";
import { getSettingsRegistry } from "../registry/index.ts";
import { SettingsHost } from "../settings/SettingsHost.tsx";

export function SettingsPage() {
  const platform = detectPlatform();
  const isMobile = platform === "mobile";

  return (
    <div className="h-full min-h-0 flex flex-col bg-base-100">
      {isMobile ? (
        <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-200 pt-[env(safe-area-inset-top)]">
          <Link to="/chat" className="btn btn-ghost btn-sm">
            返回
          </Link>
          <h1 className="flex-1 text-center text-sm font-semibold pr-12">设置</h1>
        </header>
      ) : null}
      <div className="flex-1 min-h-0">
        <SettingsHost sections={getSettingsRegistry()} platform={platform} />
      </div>
    </div>
  );
}
