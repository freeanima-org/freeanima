import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import { patchHubConfigSection } from "@freeanima/frontend/shell-sdk/hub-config-api";

import { readLlmRecordDraft } from "./hub-advanced-forms.tsx";
import {
  LlmGeneralForm,
  LlmProfilesForm,
  LlmProvidersForm,
  profilesDraftToPatch,
  providersDraftToPatch,
} from "./llm-settings-forms.tsx";

type LlmTabId = "providers" | "profiles" | "general";

const LLM_TABS: Array<{ id: LlmTabId; label: string }> = [
  { id: "providers", label: "providers" },
  { id: "profiles", label: "profiles" },
  { id: "general", label: "其它" },
];

type Props = {
  llmConfig: Record<string, unknown>;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onError: (message: string) => void;
  onSaved: (section: string) => Promise<void>;
};

export function LlmSettingsPanel({ llmConfig, saving, onSavingChange, onError, onSaved }: Props) {
  const [tab, setTab] = useState<LlmTabId>("providers");
  const [providersDraft, setProvidersDraft] = useState<Record<string, unknown>>({});
  const [profilesDraft, setProfilesDraft] = useState<Record<string, unknown>>({});
  const [defaultProfile, setDefaultProfile] = useState("chat");

  useEffect(() => {
    setProvidersDraft(readLlmRecordDraft(llmConfig.providers));
    setProfilesDraft(readLlmRecordDraft(llmConfig.profiles));
    setDefaultProfile(
      typeof llmConfig.default_profile === "string" ? llmConfig.default_profile : "chat",
    );
  }, [llmConfig]);

  const saveProviders = useCallback(async () => {
    onSavingChange(true);
    onError("");
    try {
      await patchHubConfigSection("llm", { providers: providersDraftToPatch(providersDraft) });
      await onSaved("llm.providers");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [onError, onSaved, onSavingChange, providersDraft]);

  const saveProfiles = useCallback(async () => {
    onSavingChange(true);
    onError("");
    try {
      await patchHubConfigSection("llm", { profiles: profilesDraftToPatch(profilesDraft) });
      await onSaved("llm.profiles");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [onError, onSaved, onSavingChange, profilesDraft]);

  const saveGeneral = useCallback(async () => {
    onSavingChange(true);
    onError("");
    try {
      await patchHubConfigSection("llm", {
        default_profile: defaultProfile.trim() || "chat",
      });
      await onSaved("llm");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [defaultProfile, onError, onSaved, onSavingChange]);

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        <nav className="flex flex-wrap gap-1" aria-label="LLM 配置">
          {LLM_TABS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={tab === item.id ? "default" : "ghost"}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        {tab === "providers" ? (
          <>
            <LlmProvidersForm value={providersDraft} onChange={setProvidersDraft} />
            <Button type="button" disabled={saving} onClick={() => void saveProviders()}>
              保存 providers
            </Button>
          </>
        ) : null}

        {tab === "profiles" ? (
          <>
            <LlmProfilesForm value={profilesDraft} onChange={setProfilesDraft} />
            <Button type="button" disabled={saving} onClick={() => void saveProfiles()}>
              保存 profiles
            </Button>
          </>
        ) : null}

        {tab === "general" ? (
          <>
            <LlmGeneralForm
              defaultProfile={defaultProfile}
              onDefaultProfileChange={setDefaultProfile}
            />
            <Button type="button" disabled={saving} onClick={() => void saveGeneral()}>
              保存其它配置
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
