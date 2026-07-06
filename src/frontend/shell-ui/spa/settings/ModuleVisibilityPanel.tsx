import { Checkbox, Label } from "@freeanima/ui-kit";
import {
  SHELL_MODULE_LOCKED,
  type ShellModuleId,
} from "@freeanima/shell-sdk/shell-module-visibility";
import { useSetShellModuleVisibility, useShellModuleVisibility } from "@freeanima/shell-sdk/react";
import type { SettingsPanelProps } from "@freeanima/shell-sdk/settings";

import { shellNavItems } from "../lib/shell-nav-i18n.ts";

export default function ModuleVisibilityPanel(_props: SettingsPanelProps) {
  const visible = useShellModuleVisibility();
  const setVisible = useSetShellModuleVisibility();
  const items = shellNavItems();

  const toggle = (id: ShellModuleId, checked: boolean) => {
    const next = new Set(visible);
    if (checked) next.add(id);
    else next.delete(id);
    setVisible(next);
  };

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const locked = SHELL_MODULE_LOCKED.includes(item.id);
        const checked = visible.has(item.id);
        const inputId = `shell-module-${item.id}`;
        return (
          <li key={item.id} className="flex items-start gap-3">
            <Checkbox
              id={inputId}
              checked={checked}
              disabled={locked}
              onCheckedChange={(value) => toggle(item.id, value === true)}
            />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor={inputId}
                className={locked ? "text-muted-foreground" : "cursor-pointer font-medium"}
              >
                {item.label()}
              </Label>
              {locked ? (
                <p className="text-xs text-muted-foreground mt-0.5">此模块不可关闭</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
