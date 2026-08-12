import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Input } from "@freeanima/ui-kit";
import { Label } from "@freeanima/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { FormToggle } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";
import {
  fetchHabitatConfigSection,
  patchHabitatConfigSection,
  replaceHabitatConfigSection,
} from "@freeanima/client/portal-sdk/habitat-config-api";

import {
  AdvancedSectionForm,
  readAdvancedSectionDraft,
  type AdvancedSectionId,
  isHabitatConfigRecordSection,
} from "./habitat-advanced-forms.tsx";
import { HabitatConfigConnectionTestButton } from "./HabitatConfigConnectionTestButton.tsx";
import { LlmSettingsPanel } from "./LlmSettingsPanel.tsx";
import { SpeechSettingsTab } from "./SpeechSettingsTab.tsx";
import type { HabitatConfigSectionKey } from "./habitat-config-sections.ts";

type Props = SettingsPanelProps & {
  configKey: HabitatConfigSectionKey;
};

function numberField(
  label: string,
  value: number | "",
  onChange: (v: number | "") => void,
  opts?: { min?: number; max?: number; step?: number; hint?: string },
): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        min={opts?.min}
        max={opts?.max}
        step={opts?.step}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? "" : Number(raw));
        }}
      />
      {opts?.hint ? <p className="text-xs text-muted-foreground">{opts.hint}</p> : null}
    </div>
  );
}

function isAdvancedSectionKey(key: HabitatConfigSectionKey): key is AdvancedSectionId {
  return key !== "compression" && key !== "memory" && key !== "llm" && key !== "tts";
}

const ADVANCED_TEST_SERVICES: Partial<
  Record<
    AdvancedSectionId,
    "firecrawl" | "camofox" | "embedding" | "discord" | "weixin" | "object_storage"
  >
> = {
  firecrawl: "firecrawl",
  browser: "camofox",
  embedding: "embedding",
  discord: "discord",
  weixin: "weixin",
  object_storage: "object_storage",
};

function advancedTestConfig(
  section: AdvancedSectionId,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  if (section === "browser") return { camofox: draft.camofox ?? {} };
  return draft;
}

export default function HabitatConfigSectionPanel({ configKey }: Props) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState("");
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
    min_score: 0.016,
    min_relative_score: 0.55,
    exclude_resident: true,
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const section = await fetchHabitatConfigSection(configKey);
      const asRecord =
        section && typeof section === "object" && !Array.isArray(section)
          ? (section as Record<string, unknown>)
          : {};

      if (configKey === "compression") {
        setCompression({
          enabled: asRecord.enabled !== false,
          max_rounds: typeof asRecord.max_rounds === "number" ? asRecord.max_rounds : 50,
          reserved_tokens:
            typeof asRecord.reserved_tokens === "number" ? asRecord.reserved_tokens : 8192,
        });
        setConfig({});
      } else if (configKey === "memory") {
        const recall = asRecord.passive_recall as Record<string, unknown> | undefined;
        setMemoryRecall({
          enabled: recall?.enabled !== false,
          limit: typeof recall?.limit === "number" ? recall.limit : 5,
          max_chars: typeof recall?.max_chars === "number" ? recall.max_chars : 2000,
          min_score: typeof recall?.min_score === "number" ? recall.min_score : 0.016,
          min_relative_score:
            typeof recall?.min_relative_score === "number" ? recall.min_relative_score : 0.55,
          exclude_resident: recall?.exclude_resident !== false,
        });
        setConfig({});
      } else if (configKey === "llm") {
        setConfig(asRecord);
      } else if (configKey === "tts") {
        // SpeechSettingsTab 从 config.tts 读取
        setConfig({ tts: section ?? {} });
      } else if (isAdvancedSectionKey(configKey)) {
        setAdvancedDraft(readAdvancedSectionDraft(section));
        setConfig({});
      } else {
        setConfig(asRecord);
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
      setSavedHint(`「${section}」已保存并在内存中热应用，无需重启。`);
      await load();
    },
    [load],
  );

  const saveCompression = async () => {
    setSaving(true);
    setError("");
    setSavedHint("");
    try {
      await patchHabitatConfigSection("compression", {
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
    setSavedHint("");
    try {
      await patchHabitatConfigSection("memory", {
        passive_recall: {
          enabled: memoryRecall.enabled,
          limit: memoryRecall.limit,
          max_chars: memoryRecall.max_chars,
          min_score: memoryRecall.min_score,
          min_relative_score: memoryRecall.min_relative_score,
          exclude_resident: memoryRecall.exclude_resident,
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
    setSavedHint("");
    try {
      if (isHabitatConfigRecordSection(configKey)) {
        await replaceHabitatConfigSection(configKey, advancedDraft);
      } else {
        await patchHabitatConfigSection(configKey, advancedDraft);
      }
      await afterSave(configKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (config == null && !error) {
    return <p className="text-sm text-muted-foreground">加载 Habitat 配置…</p>;
  }

  const advancedTestService = isAdvancedSectionKey(configKey)
    ? ADVANCED_TEST_SERVICES[configKey]
    : undefined;

  return (
    <div className="space-y-4">
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
      {savedHint ? <StatusAlert variant="success">{savedHint}</StatusAlert> : null}

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
            <Button type="button" isDisabled={saving} onClick={() => void saveCompression()}>
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
            {numberField(
              "最低分数",
              memoryRecall.min_score,
              (v) => setMemoryRecall((m) => ({ ...m, min_score: v === "" ? 0.016 : v })),
              {
                min: 0,
                step: 0.001,
                hint: "绝对门槛（RRF 分）。参考：0.016≈单路第1名弱相关（默认）；0.008 更松；0.03 偏严只留强相关；0 关闭绝对过滤。一般先动「相对最高分比例」。",
              },
            )}
            {numberField(
              "相对最高分比例",
              memoryRecall.min_relative_score,
              (v) => setMemoryRecall((m) => ({ ...m, min_relative_score: v === "" ? 0.55 : v })),
              {
                min: 0,
                max: 1,
                step: 0.01,
                hint: "保留分数 ≥ 本轮最高分×此比例。参考：0.7 严选；0.55 默认；0.35 宽松；0 只靠绝对门槛。召回偏少优先降到 0.35。",
              },
            )}
            <FormToggle
              className="w-full"
              label="排除常驻记忆"
              hint="已在 system prompt 常驻列表中的语义记忆不再重复注入"
              checked={memoryRecall.exclude_resident}
              onChange={(exclude_resident) => setMemoryRecall((m) => ({ ...m, exclude_resident }))}
            />
            <Button type="button" isDisabled={saving} onClick={() => void saveMemory()}>
              保存记忆配置
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {configKey === "llm" && config ? (
        <LlmSettingsPanel
          llmConfig={config}
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
          onSaved={async () => {
            await afterSave("tts");
          }}
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
              <HabitatConfigConnectionTestButton
                service={advancedTestService}
                config={advancedTestConfig(configKey, advancedDraft)}
                disabled={saving}
              />
            ) : null}
            <Button type="button" isDisabled={saving} onClick={() => void saveAdvanced()}>
              保存 {configKey}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
