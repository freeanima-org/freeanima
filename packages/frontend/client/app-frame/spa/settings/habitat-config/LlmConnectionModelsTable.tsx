import { useCallback, useEffect, useState } from "react";
import { Button } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  listHabitatProviderModels,
  type HabitatProviderModelEntry,
} from "@freeanima/client/portal-sdk/habitat-config-api";

type Props = {
  providerId: string;
  disabled?: boolean;
};

const INPUT_MODALITY_LABEL_ZH = {
  text: "文字",
  image: "图片",
  audio: "音频",
  video: "视频",
  pdf: "PDF",
} as const;

function formatTokens(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function formatCost(cost: HabitatProviderModelEntry["cost"]): string {
  if (!cost || (cost.input == null && cost.output == null)) return "—";
  const inP = cost.input != null ? `$${cost.input}` : "?";
  const outP = cost.output != null ? `$${cost.output}` : "?";
  return `${inP} / ${outP}`;
}

function formatModalities(entry: HabitatProviderModelEntry): string {
  const modalities = entry.inputModalities;
  if (!modalities?.length) return "—";
  const labels: string[] = [];
  for (const key of ["text", "image", "audio", "video", "pdf"] as const) {
    if (modalities.includes(key)) labels.push(INPUT_MODALITY_LABEL_ZH[key]);
  }
  return labels.length > 0 ? labels.join(" · ") : "—";
}

/** 连接编辑弹窗：展示该连接 /models（或 models.dev 回退）目录 */
export function LlmConnectionModelsTable({ providerId, disabled = false }: Props) {
  const id = providerId.trim();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [models, setModels] = useState<HabitatProviderModelEntry[]>([]);
  const [source, setSource] = useState<"provider" | "models_dev" | "builtin" | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setModels([]);
      setSource(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await listHabitatProviderModels({
        provider_id: id,
        limit: 500,
      });
      setModels(res.models);
      setSource(res.source);
    } catch (e) {
      setModels([]);
      setSource(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) {
    return (
      <StatusAlert variant="info" className="text-sm">
        保存连接后可拉取供应方 /models 目录。
      </StatusAlert>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">模型目录</p>
          <p className="text-muted-foreground text-xs">
            {source === "provider"
              ? "来自连接 /models"
              : source === "models_dev"
                ? "来自 models.dev 回退"
                : source === "builtin"
                  ? "来自内置模型表"
                  : "拉取供应方公开的模型列表"}
            {models.length > 0 ? ` · 共 ${models.length} 条` : null}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          isDisabled={disabled || loading}
          onClick={() => void load()}
        >
          {loading ? "拉取中…" : "刷新目录"}
        </Button>
      </div>

      {error ? (
        <StatusAlert variant="error" className="text-sm">
          {error}
          <span className="text-muted-foreground mt-1 block text-xs">
            需连接已保存且 Habitat 可访问该供应方；新建请先点「保存」后再刷新。
          </span>
        </StatusAlert>
      ) : null}

      {!loading && !error && models.length === 0 ? (
        <p className="text-muted-foreground text-xs">目录为空。</p>
      ) : null}

      {models.length > 0 ? (
        <div className="max-h-64 overflow-auto rounded-md border border-border/60">
          <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="border-b border-border/60">
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">模型 id</th>
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">名称</th>
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">上下文</th>
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">输出上限</th>
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">输入模态</th>
                <th className="px-2 py-1.5 font-medium whitespace-nowrap">$/1M</th>
              </tr>
            </thead>
            <tbody>
              {models.map((row) => (
                <tr key={row.model} className="border-b border-border/40 last:border-0">
                  <td className="max-w-[12rem] truncate px-2 py-1.5 font-mono" title={row.model}>
                    {row.model}
                  </td>
                  <td className="max-w-[10rem] truncate px-2 py-1.5" title={row.label || row.model}>
                    {row.label && row.label !== row.model ? row.label : "—"}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {formatTokens(row.contextWindow)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {formatTokens(row.maxOutputTokens)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatModalities(row)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatCost(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
