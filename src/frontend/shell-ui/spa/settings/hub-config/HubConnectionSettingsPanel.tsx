import { useEffect, useState } from "react";
import type { SettingsPanelProps } from "@freeanima/frontend/shell-sdk/settings";
import { hubFields } from "@freeanima/frontend/shell-sdk/settings";
import type { ShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";

import { FormRenderer } from "../../form/FormRenderer.tsx";
import { HubTlsCaTrustCard } from "./HubTlsCaTrustCard.tsx";

export default function HubConnectionSettingsPanel({ platform, store }: SettingsPanelProps) {
  const [hubUrl, setHubUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.load().then((raw) => {
      if (cancelled || !raw || typeof raw !== "object") return;
      const url = (raw as ShellClientConfig).hubUrl;
      if (typeof url === "string" && url.trim()) {
        setHubUrl(url.trim());
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
      <FormRenderer fields={hubFields} store={store} platform={platform} sectionId="hub" />
      <HubTlsCaTrustCard {...(hubUrl ? { hubUrl } : {})} />
    </div>
  );
}
