import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Input } from "@freeanima/ui-kit";
import { Label } from "@freeanima/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  fetchHubConfig,
  patchHubConfigSection,
  restartHubService,
} from "@freeanima/shell-sdk/hub-config-api";

type TabId = "compression" | "memory" | "llm" | "advanced";

const TABS: Array<{ id: TabId; label: string; section: string }> = [
  { id: "compression", label: "压缩", section: "compression" },
  { id: "memory", label: "记忆", section: "memory" },
  { id: "llm", label: "LLM", section: "llm" },
  { id: "advanced", label: "高级", section: "" },
];

const ADVANCED_SECTIONS = [
  "firecrawl",
  "browser",
  "embedding",
  "cjk",
  "fts",
  "models",
  "mcp_servers",
  "acp_agents",
  "tunnel",
  "web",
  "worlds",
  "auto_llm",
] as const;

function boolField(label: string, value: boolean, onChange: (v: boolean) => void): ReactNode {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

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

export default function HubRuntimeSettingsPanel() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<TabId>("compression");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [advancedSection, setAdvancedSection] = useState<string>(ADVANCED_SECTIONS[0]);
  const [advancedJson, setAdvancedJson] = useState("{}");

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
  const [llmDefaultProfile, setLlmDefaultProfile] = useState("chat");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchHubConfig();
      setConfig(data);
      const comp = (data.compression ?? {}) as Record<string, unknown>;
      setCompression({
        enabled: comp.enabled !== false,
        max_rounds: typeof comp.max_rounds === "number" ? comp.max_rounds : 50,
        reserved_tokens: typeof comp.reserved_tokens === "number" ? comp.reserved_tokens : 8192,
      });
      const mem = (data.memory as Record<string, unknown> | undefined)?.passive_recall as
        | Record<string, unknown>
        | undefined;
      setMemoryRecall({
        enabled: mem?.enabled !== false,
        limit: typeof mem?.limit === "number" ? mem.limit : 5,
        max_chars: typeof mem?.max_chars === "number" ? mem.max_chars : 2000,
      });
      const llm = (data.llm ?? {}) as Record<string, unknown>;
      setLlmDefaultProfile(typeof llm.default_profile === "string" ? llm.default_profile : "chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!config) return;
    const sectionData = config[advancedSection];
    setAdvancedJson(JSON.stringify(sectionData ?? {}, null, 2));
  }, [config, advancedSection, tab]);

  const afterSave = async (section: string) => {
    const restart = window.confirm(
      `「${section}」已保存到 Hub 数据库。是否立即重启服务使配置生效？`,
    );
    if (restart) {
      try {
        await restartHubService();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    await load();
  };

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

  const saveLlm = async () => {
    setSaving(true);
    setError("");
    try {
      const currentLlm = ((config?.llm ?? {}) as Record<string, unknown>) || {};
      await patchHubConfigSection("llm", {
        ...currentLlm,
        default_profile: llmDefaultProfile.trim() || "chat",
      });
      await afterSave("llm");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAdvanced = async () => {
    setSaving(true);
    setError("");
    try {
      const parsed = JSON.parse(advancedJson) as Record<string, unknown>;
      await patchHubConfigSection(advancedSection, parsed);
      await afterSave(advancedSection);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (config == null && !error) {
    return <p className="text-sm text-muted-foreground">加载 Hub 配置…</p>;
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "default" : "ghost"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {tab === "compression" ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            {boolField("启用会话压缩", compression.enabled, (v) =>
              setCompression((c) => ({ ...c, enabled: v })),
            )}
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

      {tab === "memory" ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            {boolField("被动语义回忆", memoryRecall.enabled, (v) =>
              setMemoryRecall((m) => ({ ...m, enabled: v })),
            )}
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

      {tab === "llm" ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            <div className="space-y-1">
              <Label className="text-sm">默认 profile</Label>
              <Input
                value={llmDefaultProfile}
                onChange={(e) => setLlmDefaultProfile(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              providers / profiles 完整编辑请使用「高级」JSON；保存后建议重启服务。
            </p>
            <Button type="button" disabled={saving} onClick={() => void saveLlm()}>
              保存 LLM 配置
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === "advanced" ? (
        <Card className="bg-muted py-0">
          <CardContent className="gap-4 py-4">
            <div className="space-y-1">
              <Label className="text-sm">配置段</Label>
              <select
                className="select select-bordered select-sm w-full max-w-xs"
                value={advancedSection}
                onChange={(e) => setAdvancedSection(e.target.value)}
              >
                {ADVANCED_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="textarea textarea-bordered w-full min-h-48 font-mono text-xs"
              value={advancedJson}
              onChange={(e) => setAdvancedJson(e.target.value)}
            />
            <Button type="button" disabled={saving} onClick={() => void saveAdvanced()}>
              保存 {advancedSection}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
