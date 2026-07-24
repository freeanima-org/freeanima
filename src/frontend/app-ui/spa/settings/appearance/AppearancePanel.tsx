import { Button } from "@freeanima/frontend/ui-kit";
import {
  COLOR_THEME_IDS,
  COLOR_THEME_SWATCH,
  type ColorThemeId,
} from "@freeanima/frontend/portal-sdk/color-theme";
import { useColorTheme, useSetColorTheme } from "@freeanima/frontend/portal-sdk/react.tsx";
import type { SettingsPanelProps } from "@freeanima/frontend/portal-sdk/settings";
import { m } from "@paraglide/messages";
import { Check } from "lucide-react";

function themeLabel(id: ColorThemeId): string {
  switch (id) {
    case "neutral":
      return m.settings_appearance_theme_neutral();
    case "ocean":
      return m.settings_appearance_theme_ocean();
    case "forest":
      return m.settings_appearance_theme_forest();
    case "sunset":
      return m.settings_appearance_theme_sunset();
    case "violet":
      return m.settings_appearance_theme_violet();
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export default function AppearancePanel(_props: SettingsPanelProps) {
  const theme = useColorTheme();
  const setTheme = useSetColorTheme();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{m.settings_appearance_hint()}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {COLOR_THEME_IDS.map((id) => {
          const selected = theme === id;
          return (
            <li key={id}>
              <Button
                type="button"
                variant={selected ? "default" : "outline"}
                className="flex h-auto w-full flex-col items-stretch gap-2 p-3"
                aria-pressed={selected}
                onClick={() => setTheme(id)}
              >
                <span
                  className="relative flex h-10 w-full items-center justify-center rounded-md border border-border"
                  style={{ backgroundColor: COLOR_THEME_SWATCH[id] }}
                  aria-hidden
                >
                  {selected ? <Check className="size-4 text-white drop-shadow" /> : null}
                </span>
                <span className="text-center text-sm font-medium">{themeLabel(id)}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
