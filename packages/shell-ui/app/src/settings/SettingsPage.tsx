import { useLayoutMode } from "../layout-mode.ts";
import { resolveSettingsPlatform } from "../platform.ts";
import { useShellAppBindings } from "../shell-app-context.tsx";
import { SettingsHost } from "./SettingsHost.tsx";

export function SettingsPage() {
  const layoutMode = useLayoutMode();
  const platform = resolveSettingsPlatform({ layoutMode });
  const bindings = useShellAppBindings();

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="flex-1 min-h-0">
        <SettingsHost bindings={bindings} platform={platform} />
      </div>
    </div>
  );
}
