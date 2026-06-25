import { getSettingsRegistry } from "../registry/index.ts";
import { SettingsHost } from "../settings/SettingsHost.tsx";
import { detectPlatform } from "../platform.ts";

export function SettingsPage() {
  const platform = detectPlatform();

  return (
    <div className="h-full min-h-0 flex flex-col bg-base-100">
      <div className="flex-1 min-h-0">
        <SettingsHost sections={getSettingsRegistry()} platform={platform} />
      </div>
    </div>
  );
}
