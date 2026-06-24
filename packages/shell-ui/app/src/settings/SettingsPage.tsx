import { SettingsHost } from "../settings/SettingsHost.tsx";
import { getSettingsRegistry } from "../registry/index.ts";
import { detectPlatform } from "../platform.ts";

export function SettingsPage() {
  const platform = detectPlatform();
  return (
    <div className="h-full min-h-0 bg-base-100">
      <SettingsHost exports={getSettingsRegistry()} platform={platform} />
    </div>
  );
}
