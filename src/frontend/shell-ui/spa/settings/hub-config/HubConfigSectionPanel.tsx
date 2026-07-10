import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Input } from "@freeanima/frontend/ui-kit";
import { Label } from "@freeanima/frontend/ui-kit/components/ui";
import { StatusAlert, showConfirm } from "@freeanima/frontend/ui-kit/composite";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import type { SettingsPanelProps } from "@freeanima/frontend/shell-sdk/settings";
import {
  fetchHubConfig,
  patchHubConfigSection,
  restartHubService,
} from "@freeanima/frontend/shell-sdk/hub-config-api";

import { m as uiMessages } from "@paraglide/messages";
import {
  AdvancedSectionForm,
  readAdvancedSectionDraft,
  type AdvancedSectionId,
} from "./hub-advanced-forms.tsx";
import { HubConfigConnectionTestButton } from "./HubConfigConnectionTestButton.tsx";
import { LlmSettingsPanel } from "./LlmSettingsPanel.tsx";
import { SpeechSettingsTab } from "./SpeechSettingsTab.tsx";
import type { HubConfigSectionKey } from "./hub-config-sections.ts";

type Props = SettingsPanelProps & {
  configKey: HubConfigSectionKey;
};

function numberField(
  label: string,
  value: number | "",
  onChange: (v: number | "") => void,
): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? "" : Number(raw));
        }}
      />
    </div>
  );
}

function isAdvancedSectionKey(key: HubConfigSectionKey): key is AdvancedSectionId {
  return key !== "compression" && key !== "memory" && key !== "llm" && key !== "tts";
}

const ADVANCED_TEST_SERVICES: Partial<
  Record<AdvancedSectionId, "firecrawl" | "camofox" | "embedding">
> = {
  firecrawl: "firecrawl",
  browser: "camofox",
  embedding: "embedding",
};

function advancedTestConfig(
  section: AdvancedSectionId,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  if (section === "browser") return { camofox: draft.camofox ?? {} };
  return draft;
}

export default function HubConfigSectionPanel({ configKey }: Props) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<Record<string, unknown>>({});

  const [compression, setCompression] = useState({
    enabled: true,
    max_rounds: 50,
    reserved_tokens: 8192,
  });
  const [memoryRecall, setMemoryRecall] = useState({
    enabled: true,
    limit: 5,
    max_chars: 2000,
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchHubConfig();
      setConfig(data ?? {});
      const safe = data ?? {};
      const comp = (safe.compression ?? {}) as Record<string, unknown>;
      setCompression({
        enabled: comp.enabled !== false,
        max_rounds: typeof comp.max_rounds === "number" ? comp.max_rounds : 50,
        reserved_tokens: typeof comp.reserved_tokens === "number" ? comp.reserved_tokens : 8192,
      });
      const mem = (safe.memory as Record<string, unknown> | undefined)?.passive_recall as
        | Record<string, unknown>
        | undefined;
      setMemoryRecall({
        enabled: mem?.enabled !== false,
        limit: typeof mem?.limit === "number" ? mem.limit : 5,
        max_chars: typeof mem?.max_chars === "number" ? mem.max_chars : 2000,
      });
      if (isAdvancedSectionKey(configKey)) {
        setAdvancedDraft(readAdvancedSectionDraft(safe[configKey]));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const afterSave = useCallback(
    async (section: string) => {
      const restart = await showConfirm({
        title: uiMessages.ui_hub_config_saved_restart_title(),
        description: uiMessages.ui_hub_config_saved_restart_description({ section }),
        confirmLabel: uiMessages.console_common_restart_service(),
      });
      if (restart) {
        try {
          await restartHubService();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
      await load();
    },
    [load],
  );

  const saveCompression = async () => {
    setSaving(true);
    setError("");
    try {
      await patchHubConfigSection("compression", {
        enabled: compression.enabled,
        max_rounds: compression.max_rounds,
        reserved_tokens: compression.reserved_tokens,
      });
      await afterSave("compression");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveMemory = async () => {
    setSaving(true);
    setError("");
    try {
      await patchHubConfigSection("memory", {
        passive_recall: {
          enabled: memoryRecall.enabled,
          limit: memoryRecall.limit,
          max_chars: memoryRecall.max_chars,
        },
      });
      await afterSave("memory");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAdvanced = async () => {
    if (!isAdvancedSectionKey(configKey)) return;
    setSaving(true);
    setError("");
    try {
      await patchHubConfigSection(configKey, advancedDraft);
      await afterSave(configKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (config == null && !error) {
    return <p className="text-sm text-muted-foreground">加载 Hub 配置…</p>;
  }

  const advancedTestService = isAdvancedSectionKey(configKey)
    ? ADVANCED_TEST_SERVICES[configKey]
    : undefined;

  return (
    <div className="space-y-4">
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {configKey === "compression" ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            <FormToggle
              className="w-full"
              label="启用会话压缩"
              checked={compression.enabled}
              onChange={(enabled) => setCompression((c) => ({ ...c, enabled }))}
            />
            {numberField("最大轮次", compression.max_rounds, (v) =>
              setCompression((c) => ({ ...c, max_rounds: v === "" ? 50 : v })),
            )}
            {numberField("保留 token", compression.reserved_tokens, (v) =>
              setCompression((c) => ({ ...c, reserved_tokens: v === "" ? 8192 : v })),
            )}
            <Button type="button" disabled={saving} onClick={() => void saveCompression()}>
              保存压缩配置
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {configKey === "memory" ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            <FormToggle
              className="w-full"
              label="被动语义回忆"
              checked={memoryRecall.enabled}
              onChange={(enabled) => setMemoryRecall((m) => ({ ...m, enabled }))}
            />
            {numberField("检索条数上限", memoryRecall.limit, (v) =>
              setMemoryRecall((m) => ({ ...m, limit: v === "" ? 5 : v })),
            )}
            {numberField("注入字符上限", memoryRecall.max_chars, (v) =>
              setMemoryRecall((m) => ({ ...m, max_chars: v === "" ? 2000 : v })),
            )}
            <Button type="button" disabled={saving} onClick={() => void saveMemory()}>
              保存记忆配置
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {configKey === "llm" && config ? (
        <LlmSettingsPanel
          llmConfig={(config.llm ?? {}) as Record<string, unknown>}
          saving={saving}
          onSavingChange={setSaving}
          onError={setError}
          onSaved={afterSave}
        />
      ) : null}

      {configKey === "tts" && config ? (
        <SpeechSettingsTab
          config={config}
          saving={saving}
          onSavingChange={setSaving}
          onError={setError}
          onSaved={load}
        />
      ) : null}

      {isAdvancedSectionKey(configKey) ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            <AdvancedSectionForm
              section={configKey}
              value={advancedDraft}
              onChange={setAdvancedDraft}
            />
            {advancedTestService ? (
              <HubConfigConnectionTestButton
                service={advancedTestService}
                config={advancedTestConfig(configKey, advancedDraft)}
                disabled={saving}
              />
            ) : null}
            <Button type="button" disabled={saving} onClick={() => void saveAdvanced()}>
              保存 {configKey}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
