import type { ReactNode, Key } from "react";
import { isRecord } from "@freeanima/shared/util";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/ui-kit";
import { Label } from "@freeanima/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { FormToggle } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";
import {
  fetchHabitatConfigSection,
  patchHabitatConfigSection,
} from "@freeanima/client/portal-sdk/habitat-config-api";

import {
  AdvancedSectionForm,
  readAdvancedSectionDraft,
  type AdvancedSectionId,
} from "./habitat-advanced-forms.tsx";
import { HabitatConfigConnectionTestButton } from "./HabitatConfigConnectionTestButton.tsx";
import { LlmSettingsPanel } from "./LlmSettingsPanel.tsx";
import { SpeechSettingsTab } from "./SpeechSettingsTab.tsx";
import type { HabitatConfigSectionKey } from "./habitat-config-sections.ts";

type Props = SettingsPanelProps & {
  configKey: HabitatConfigSectionKey;
};

type SemanticMemoryTabId = "passive_recall" | "semantic_clustering";

function asConfigRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function pickConfigRecord(
  primary: Record<string, unknown>,
  legacyNested: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return Object.keys(primary).length > 0 ? primary : (legacyNested ?? {});
}

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
  return (
    key !== "compression" &&
    key !== "memory" &&
    key !== "llm" &&
    key !== "tts" &&
    key !== "connections" &&
    key !== "text_generate" &&
    key !== "image_generate" &&
    key !== "audio_generate" &&
    key !== "video_generate" &&
    key !== "embedding" &&
    key !== "dialogue" &&
    key !== "image_gen" &&
    key !== "voice" &&
    key !== "retrieval"
  );
}

function resolveCapabilityKey(
  key: HabitatConfigSectionKey,
):
  | "connections"
  | "text_generate"
  | "image_generate"
  | "audio_generate"
  | "video_generate"
  | "embedding"
  | null {
  if (key === "llm" || key === "connections") return "connections";
  if (key === "dialogue" || key === "text_generate") return "text_generate";
  if (key === "image_gen" || key === "image_generate") return "image_generate";
  if (key === "voice" || key === "audio_generate") return "audio_generate";
  if (key === "video_generate") return "video_generate";
  if (key === "retrieval" || key === "embedding") return "embedding";
  return null;
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
  const [autoLlmDraft, setAutoLlmDraft] = useState<Record<string, unknown>>({});

  const [compression, setCompression] = useState({
    enabled: true,
    max_message_pairs: 50,
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
  const [memoryClustering, setMemoryClustering] = useState({
    enabled: true,
    min_points: 3,
    min_samples: 2,
    peel_small: false,
    eps: 0.35,
    max_calibrate_n: 5000,
  });
  const [semanticMemoryTab, setSemanticMemoryTab] = useState<SemanticMemoryTabId>("passive_recall");

  const load = useCallback(async () => {
    setError("");
    try {
      if (configKey === "compression") {
        const section = await fetchHabitatConfigSection(configKey);
        const asRecord = asConfigRecord(section);
        setCompression({
          enabled: asRecord.enabled !== false,
          max_message_pairs:
            typeof asRecord.max_message_pairs === "number" ? asRecord.max_message_pairs : 50,
          reserved_tokens:
            typeof asRecord.reserved_tokens === "number" ? asRecord.reserved_tokens : 8192,
        });
        setConfig({});
        return;
      }

      if (configKey === "memory") {
        const [passiveSec, clusteringSec, legacyMemorySec] = await Promise.all([
          fetchHabitatConfigSection("passive_recall"),
          fetchHabitatConfigSection("semantic_clustering"),
          fetchHabitatConfigSection("memory"),
        ]);
        const legacyMemory = asConfigRecord(legacyMemorySec);
        const recall = pickConfigRecord(
          asConfigRecord(passiveSec),
          asConfigRecord(legacyMemory.passive_recall),
        );
        setMemoryRecall({
          enabled: recall.enabled !== false,
          limit: typeof recall.limit === "number" ? recall.limit : 5,
          max_chars: typeof recall.max_chars === "number" ? recall.max_chars : 2000,
          min_score: typeof recall.min_score === "number" ? recall.min_score : 0.016,
          min_relative_score:
            typeof recall.min_relative_score === "number" ? recall.min_relative_score : 0.55,
          exclude_resident: recall.exclude_resident !== false,
        });
        const clustering = pickConfigRecord(
          asConfigRecord(clusteringSec),
          asConfigRecord(legacyMemory.clustering),
        );
        const minPoints = typeof clustering.min_points === "number" ? clustering.min_points : 3;
        setMemoryClustering({
          enabled: clustering.enabled !== false,
          min_points: minPoints,
          min_samples:
            typeof clustering.min_samples === "number"
              ? clustering.min_samples
              : Math.max(1, minPoints - 1),
          peel_small: clustering.peel_small === true,
          eps: typeof clustering.eps === "number" ? clustering.eps : 0.35,
          max_calibrate_n:
            typeof clustering.max_calibrate_n === "number" ? clustering.max_calibrate_n : 5000,
        });
        setConfig({});
        return;
      }

      const capabilityKey = resolveCapabilityKey(configKey);
      if (capabilityKey) {
        const [connectionsSec, layerSec] = await Promise.all([
          fetchHabitatConfigSection("connections"),
          capabilityKey === "connections"
            ? Promise.resolve({})
            : fetchHabitatConfigSection(capabilityKey),
        ]);
        const next: Record<string, unknown> = {
          connections: asConfigRecord(connectionsSec),
        };
        if (capabilityKey !== "connections") {
          next[capabilityKey] = asConfigRecord(layerSec);
        }
        if (capabilityKey === "audio_generate") {
          try {
            const ttsSec = await fetchHabitatConfigSection("tts");
            next.tts = ttsSec ?? {};
          } catch {
            next.tts = {};
          }
        }
        if (capabilityKey === "text_generate") {
          const autoSec = await fetchHabitatConfigSection("auto_llm");
          setAutoLlmDraft(readAdvancedSectionDraft(autoSec));
        }
        setConfig(next);
        return;
      }

      const fetchKey = configKey === "tts" ? "tts" : configKey;
      const section = await fetchHabitatConfigSection(fetchKey);
      const asRecord = asConfigRecord(section);

      if (fetchKey === "tts") {
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
        max_message_pairs: compression.max_message_pairs,
        reserved_tokens: compression.reserved_tokens,
      });
      await afterSave("compression");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const savePassiveRecall = async () => {
    setSaving(true);
    setError("");
    setSavedHint("");
    try {
      await patchHabitatConfigSection("passive_recall", {
        enabled: memoryRecall.enabled,
        limit: memoryRecall.limit,
        max_chars: memoryRecall.max_chars,
        min_score: memoryRecall.min_score,
        min_relative_score: memoryRecall.min_relative_score,
        exclude_resident: memoryRecall.exclude_resident,
      });
      await afterSave("被动语义召回");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveSemanticClustering = async () => {
    setSaving(true);
    setError("");
    setSavedHint("");
    try {
      await patchHabitatConfigSection("semantic_clustering", {
        enabled: memoryClustering.enabled,
        min_points: memoryClustering.min_points,
        min_samples: memoryClustering.min_samples,
        peel_small: memoryClustering.peel_small,
        eps: memoryClustering.eps,
        max_calibrate_n: memoryClustering.max_calibrate_n,
      });
      await afterSave("语义聚类");
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
      await patchHabitatConfigSection(configKey, advancedDraft);
      await afterSave(configKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAdvancedAs = async (
    section: AdvancedSectionId,
    draft: Record<string, unknown> = advancedDraft,
  ) => {
    setSaving(true);
    setError("");
    setSavedHint("");
    try {
      await patchHabitatConfigSection(section, draft);
      await afterSave(section);
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
            {numberField("消息对数阈值", compression.max_message_pairs, (v) =>
              setCompression((c) => ({ ...c, max_message_pairs: v === "" ? 50 : v })),
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
        <Tabs
          selectedKey={semanticMemoryTab}
          onSelectionChange={(key: Key) => {
            if (key === "passive_recall" || key === "semantic_clustering") {
              setSemanticMemoryTab(key);
            }
          }}
        >
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger id="passive_recall">被动语义召回</TabsTrigger>
            <TabsTrigger id="semantic_clustering">语义聚类</TabsTrigger>
          </TabsList>
          <TabsContent id="passive_recall" className="mt-4">
            <Card className="bg-muted py-0">
              <CardContent className="gap-4 py-4">
                <FormToggle
                  className="w-full"
                  label="启用被动语义召回"
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
                  (v) =>
                    setMemoryRecall((m) => ({
                      ...m,
                      min_relative_score: v === "" ? 0.55 : v,
                    })),
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
                  onChange={(exclude_resident) =>
                    setMemoryRecall((m) => ({ ...m, exclude_resident }))
                  }
                />
                <Button type="button" isDisabled={saving} onClick={() => void savePassiveRecall()}>
                  保存被动语义召回
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent id="semantic_clustering" className="mt-4">
            <Card className="bg-muted py-0">
              <CardContent className="gap-4 py-4">
                <FormToggle
                  className="w-full"
                  label="启用语义聚类"
                  hint="embedding 开启时默认启用；关闭后不再全量校准与增量并入"
                  checked={memoryClustering.enabled}
                  onChange={(enabled) => setMemoryClustering((c) => ({ ...c, enabled }))}
                />
                {numberField(
                  "最小簇大小",
                  memoryClustering.min_points,
                  (v) => {
                    const min_points = v === "" ? 3 : v;
                    setMemoryClustering((c) => ({
                      ...c,
                      min_points,
                      min_samples:
                        c.min_samples > 0
                          ? Math.min(c.min_samples, Math.max(1, min_points))
                          : c.min_samples,
                    }));
                  },
                  {
                    min: 2,
                    step: 1,
                    hint: "min_cluster_size。越小越容易成簇、未分组越少；过小会出现很多 2～3 条的碎簇。默认 3。",
                  },
                )}
                {numberField(
                  "核心邻域点数",
                  memoryClustering.min_samples,
                  (v) => setMemoryClustering((c) => ({ ...c, min_samples: v === "" ? 2 : v })),
                  {
                    min: 1,
                    step: 1,
                    hint: "min_samples，影响密度估计。默认一般为「最小簇大小 − 1」。调大 → 更强调紧密团，边缘更易成未分组。",
                  },
                )}
                <FormToggle
                  className="w-full"
                  label="剥落过小侧（更纯、更多未分组）"
                  hint="关闭（默认）：只切开两个都够大的团，未分组更少。开启：不够大的一侧剥成未分组，簇更纯，但不会把噪声硬挂回簇。"
                  checked={memoryClustering.peel_small}
                  onChange={(peel_small) => setMemoryClustering((c) => ({ ...c, peel_small }))}
                />
                {numberField(
                  "新记忆并入距离",
                  memoryClustering.eps,
                  (v) => setMemoryClustering((c) => ({ ...c, eps: v === "" ? 0.35 : v })),
                  {
                    min: 0.05,
                    max: 2,
                    step: 0.01,
                    hint: "仅增量：新写入记忆与最近已有族的余弦距离上限。全量 HDBSCAN 不用此值。默认 0.35（约相似度≥0.65）；调小更严。",
                  },
                )}
                {numberField(
                  "全量校准条数上限",
                  memoryClustering.max_calibrate_n,
                  (v) =>
                    setMemoryClustering((c) => ({
                      ...c,
                      max_calibrate_n: v === "" ? 5000 : v,
                    })),
                  {
                    min: 100,
                    step: 100,
                    hint: "超过则跳过全量校准以保护小规格机器。默认 5000。",
                  },
                )}
                <Button
                  type="button"
                  isDisabled={saving}
                  onClick={() => void saveSemanticClustering()}
                >
                  保存语义聚类
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}

      {resolveCapabilityKey(configKey) && config ? (
        <>
          <LlmSettingsPanel
            config={config}
            saving={saving}
            onSavingChange={setSaving}
            onError={setError}
            onSaved={afterSave}
            panelFocus={resolveCapabilityKey(configKey) ?? "connections"}
          />
          {resolveCapabilityKey(configKey) === "text_generate" ? (
            <Card className="mt-4 bg-muted py-0">
              <CardContent className="gap-4 py-4">
                <p className="text-sm font-medium">自动 LLM 运行参数</p>
                <p className="text-xs text-muted-foreground">
                  审计保留与子代理预算（非模型路由；路由见上方场景）。
                </p>
                <AdvancedSectionForm
                  section="auto_llm"
                  value={autoLlmDraft}
                  onChange={setAutoLlmDraft}
                />
                <Button
                  type="button"
                  isDisabled={saving}
                  onClick={() => void saveAdvancedAs("auto_llm", autoLlmDraft)}
                >
                  保存自动 LLM
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {resolveCapabilityKey(configKey) === "audio_generate" ? (
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
        </>
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
