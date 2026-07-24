import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SettingsPanelProps } from "@freeanima/frontend/portal-sdk/settings";
import { habitatFields } from "@freeanima/frontend/portal-sdk/settings";
import type { ShellClientConfig } from "@freeanima/frontend/portal-sdk/shell-client-config";

import { FormRenderer } from "../../form/FormRenderer.tsx";
import { needsHabitatSetup } from "../../setup/habitat-setup.ts";
import { HabitatTlsCaTrustCard } from "./HabitatTlsCaTrustCard.tsx";

export default function HabitatConnectionSettingsPanel({ platform, store }: SettingsPanelProps) {
  const [habitatUrl, setHabitatUrl] = useState<string | undefined>();
  const navigate = useNavigate();
  const gateMode = needsHabitatSetup();

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.load().then((raw) => {
      if (cancelled || !raw || typeof raw !== "object") return;
      const url = (raw as ShellClientConfig).habitatUrl;
      if (typeof url === "string" && url.trim()) {
        setHabitatUrl(url.trim());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (!store) {
    return <p className="text-sm text-destructive">缺少 settings store 注入</p>;
  }

  return (
    <div className="space-y-6">
      {gateMode ? (
        <header className="space-y-2">
          <h2 className="text-lg font-semibold">连接 FreeAnima 栖息地</h2>
          <p className="text-sm text-muted-foreground">
            首次使用请填写栖息地地址与 API Token，保存后进入应用。
          </p>
        </header>
      ) : null}
      <FormRenderer
        fields={habitatFields}
        store={store}
        platform={platform}
        sectionId="habitat"
        enterAfterSave={gateMode}
        onEnterAfterSave={() => void navigate({ to: "/chat" as never })}
      />
      <HabitatTlsCaTrustCard {...(habitatUrl ? { habitatUrl } : {})} />
    </div>
  );
}
