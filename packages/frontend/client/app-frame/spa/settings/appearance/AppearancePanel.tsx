import { Button } from "@freeanima/ui-kit";
import {
  COLOR_THEME_IDS,
  COLOR_THEME_SWATCH,
  type ColorThemeId,
} from "@freeanima/client/portal-sdk/color-theme";
import { useColorTheme, useSetColorTheme } from "@freeanima/client/portal-sdk/react.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";
import { Check } from "lucide-react";

function themeLabel(id: ColorThemeId): string {
  switch (id) {
    case "neutral":
      return "中性";
    case "ocean":
      return "海洋";
    case "forest":
      return "森林";
    case "sunset":
      return "日落";
    case "violet":
      return "紫罗兰";
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
      <p className="text-sm text-muted-foreground">
        {"选择一种强调色，便于一眼区分不同环境。仅保存在本机。"}
      </p>
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
