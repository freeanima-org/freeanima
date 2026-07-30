import { useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import type { SubjectKind } from "@freeanima/client/portal-sdk";
import { getUserVaultSession, VAULT_UI_SCOPE } from "@freeanima/client/portal-sdk/react.tsx";
import { extractCustomFieldNames } from "@freeanima/shared/vault-crypto";
import {
  indexBitwardenImportRefs,
  parseBitwardenExport,
  planBitwardenImport,
  type BitwardenImportMode,
  type BitwardenImportPlanEntry,
  type BitwardenMappedItem,
} from "@freeanima/features/vault/domain/bitwarden-import.ts";
import { createVaultItem, fetchVaultItems, patchVaultItem } from "../lib/api.ts";
import { createTag, searchTags } from "@freeanima/features/tag/ui/spa/lib/api.ts";

async function ensureTagIdsFromTitles(titles: string[]): Promise<number[]> {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const raw of titles) {
    const title = raw.trim();
    if (!title) continue;
    const found = await searchTags(title, { limit: 20 });
    const exact = found.find((t) => t.title.toLowerCase() === title.toLowerCase());
    const tag = exact ?? (await createTag(title));
    if (!seen.has(tag.id)) {
      seen.add(tag.id);
      ids.push(tag.id);
    }
  }
  return ids;
}

export function BitwardenImportDialog({
  open,
  subjectKind,
  disabled,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  subjectKind: SubjectKind;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<BitwardenImportMode>("upsert");
  const [fileName, setFileName] = useState("");
  const [mappedItems, setMappedItems] = useState<BitwardenMappedItem[] | null>(null);
  const [existingIndex, setExistingIndex] = useState<Map<string, number> | null>(null);
  const [plan, setPlan] = useState<BitwardenImportPlanEntry[] | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    failed: string[];
  } | null>(null);

  const reset = () => {
    setFileName("");
    setMappedItems(null);
    setExistingIndex(null);
    setPlan(null);
    setError("");
    setResult(null);
  };

  const rebuildPlan = (
    items: BitwardenMappedItem[],
    index: Map<string, number>,
    nextMode: BitwardenImportMode,
  ) => {
    setPlan(planBitwardenImport(items, index, nextMode));
  };

  const onFile = async (file: File | null) => {
    setError("");
    setResult(null);
    setPlan(null);
    setMappedItems(null);
    setExistingIndex(null);
    if (!file) {
      setFileName("");
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseBitwardenExport(text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      const existing = await fetchVaultItems(subjectKind, { limit: 10_000 });
      const index = indexBitwardenImportRefs(existing);
      setMappedItems(parsed.items);
      setExistingIndex(index);
      rebuildPlan(parsed.items, index, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const summary = plan
    ? {
        create: plan.filter((p) => p.action === "create").length,
        update: plan.filter((p) => p.action === "update").length,
        skip: plan.filter((p) => p.action === "skip").length,
      }
    : null;

  const runImport = async () => {
    if (!plan || subjectKind !== "user") return;
    const session = getUserVaultSession();
    if (!session.isUnlocked(VAULT_UI_SCOPE)) {
      setError("请先解锁用户保险库");
      return;
    }
    setRunning(true);
    setError("");
    setResult(null);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failed: string[] = [];
    try {
      for (const entry of plan) {
        if (entry.action === "skip") {
          skipped += 1;
          continue;
        }
        try {
          const { mapped } = entry;
          const sealed = await session.sealSecrets(mapped.secrets);
          const tag_ids = await ensureTagIdsFromTitles(mapped.tags);
          const meta = {
            title: mapped.title,
            content: mapped.content,
            item_type: mapped.item_type,
            ...(mapped.url ? { url: mapped.url } : {}),
            ...(mapped.uris ? { uris: mapped.uris } : {}),
            ...(mapped.username ? { username: mapped.username } : {}),
            ...(tag_ids.length > 0 ? { tag_ids } : {}),
            secrets_enc: sealed.secrets_enc,
            dek_wrapped: sealed.dek_wrapped,
            custom_field_names: extractCustomFieldNames(mapped.secrets),
            ...(mapped.bitwarden_id ? { import_refs: { bitwarden: mapped.bitwarden_id } } : {}),
          };
          if (entry.action === "create") {
            await createVaultItem("user", meta);
            created += 1;
          } else if (entry.action === "update" && entry.local_id != null) {
            await patchVaultItem("user", { id: entry.local_id, ...meta });
            updated += 1;
          }
        } catch (e) {
          failed.push(`${entry.mapped.title}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      setResult({ created, updated, skipped, failed });
      await onDone();
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      className="max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>导入 Bitwarden</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          选择未加密的 Bitwarden JSON 导出。按 cipher UUID（import_refs.bitwarden）幂等更新。
        </p>
        {subjectKind !== "user" ? (
          <StatusAlert variant="error">Bitwarden 导入仅支持用户保险库</StatusAlert>
        ) : null}
        {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
        {result ? (
          <StatusAlert variant={result.failed.length > 0 ? "warning" : "success"}>
            新建 {result.created} · 更新 {result.updated} · 跳过 {result.skipped}
            {result.failed.length > 0 ? ` · 失败 ${result.failed.length}` : ""}
          </StatusAlert>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={mode === "create_only"}
            disabled={disabled || running}
            onChange={(e) => {
              const next: BitwardenImportMode = e.target.checked ? "create_only" : "upsert";
              setMode(next);
              setResult(null);
              if (mappedItems && existingIndex) {
                rebuildPlan(mappedItems, existingIndex, next);
              }
            }}
          />
          <span>仅新建、不覆盖已存在（按 Bitwarden UUID；取消勾选则为 upsert）</span>
        </label>
        <div className="space-y-2">
          <input
            type="file"
            accept="application/json,.json"
            disabled={disabled || running || subjectKind !== "user"}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {fileName ? <p className="text-xs text-muted-foreground">已选：{fileName}</p> : null}
        </div>
        {summary ? (
          <p className="text-sm text-muted-foreground">
            预览：新建 {summary.create} · 更新 {summary.update} · 跳过 {summary.skip}
          </p>
        ) : null}
        {result?.failed.length ? (
          <ul className="max-h-32 overflow-y-auto text-xs text-destructive">
            {result.failed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={running}
          onClick={() => {
            reset();
            onOpenChange(false);
          }}
        >
          关闭
        </Button>
        <Button
          type="button"
          disabled={disabled || running || !plan || plan.length === 0 || subjectKind !== "user"}
          onClick={() => void runImport()}
        >
          {running ? <Spinner className="size-4" /> : "开始导入"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
