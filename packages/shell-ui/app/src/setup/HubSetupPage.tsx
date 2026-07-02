import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@freeanima/ui-kit";
import type {
  SettingsBinding,
  SettingsFormFields,
  SettingsPlatform,
} from "@freeanima/shell-sdk/settings";

import { FormRenderer } from "../form/FormRenderer.tsx";
import { detectPlatform } from "../platform.ts";
import { useShellAppBindings } from "../shell-app-context.tsx";

function resolveHubFormBinding(
  bindings: SettingsBinding[],
  platform: SettingsPlatform,
): { binding: SettingsBinding; formFields: SettingsFormFields } | null {
  const binding = bindings.find((b) => b.section.id === "hub");
  if (!binding?.store) return null;
  const entry = binding.section.platforms[platform];
  if (!entry || entry.kind !== "form") return null;
  return { binding, formFields: entry.fields };
}

export function HubSetupPage() {
  const bindings = useShellAppBindings();
  const platform = detectPlatform();
  const navigate = useNavigate();
  const hub = resolveHubFormBinding(bindings, platform);

  if (!hub) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted">
        <p className="text-sm text-destructive">Hub 设置未注入，无法完成引导。</p>
      </div>
    );
  }

  const { section, store } = hub.binding;
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted">
        <p className="text-sm text-destructive">Hub 设置未注入，无法完成引导。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted text-foreground">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 pt-6">
          <header className="space-y-2 text-center">
            <h1 className="text-xl font-semibold">连接 FreeAnima Hub</h1>
            {section.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {section.description}
              </p>
            ) : null}
          </header>
          <FormRenderer
            fields={hub.formFields}
            store={store}
            platform={platform}
            sectionId={section.id}
            enterAfterSave
            onEnterAfterSave={() => void navigate({ to: "/chat" })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
