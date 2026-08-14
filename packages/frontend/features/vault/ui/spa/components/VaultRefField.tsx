import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
} from "@freeanima/ui-kit";
import type { SubjectKind } from "@freeanima/client/portal-sdk";
import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";

import { fetchVaultItems } from "../lib/api.ts";
import { formatVaultRef, parseVaultRef, vaultRefFieldCandidates } from "../lib/vault-ref.ts";

export type VaultRefFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  type?: "text" | "password";
  placeholder?: string;
  /** Habitat 运行时 resolve 固定 Agent 库；默认 agent */
  subjectKind?: SubjectKind;
};

export function VaultRefField({
  value,
  onChange,
  label,
  hint,
  disabled = false,
  type = "text",
  placeholder = "未设置",
  subjectKind = "agent",
}: VaultRefFieldProps): ReactNode {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseVaultRef(value), [value]);
  const inputType = parsed ? "text" : type;

  return (
    <div className="space-y-1">
      {label ? <Label className="text-sm">{label}</Label> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type={inputType}
          className="min-w-0 flex-1"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          isDisabled={disabled}
          onClick={() => setOpen(true)}
        >
          从 Vault 选择
        </Button>
      </div>
      {parsed ? (
        <p className="text-xs text-muted-foreground font-mono">
          Agent #{parsed.itemId} · {parsed.field}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <VaultRefPickerDialog
        open={open}
        subjectKind={subjectKind}
        initial={parsed}
        onClose={() => setOpen(false)}
        onSelect={(itemId, field) => {
          onChange(formatVaultRef(itemId, field));
          setOpen(false);
        }}
      />
    </div>
  );
}

type VaultRefPickerDialogProps = {
  open: boolean;
  subjectKind: SubjectKind;
  initial: { itemId: number; field: string } | null;
  onSelect: (itemId: number, field: string) => void;
  onClose: () => void;
};

function VaultRefPickerDialog({
  open,
  subjectKind,
  initial,
  onSelect,
  onClose,
}: VaultRefPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<VaultItemMetaRowPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<VaultItemMetaRowPayload | null>(null);
  const [field, setField] = useState("password");

  const loadItems = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      setError("");
      try {
        const rows = await fetchVaultItems(subjectKind, {
          ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
          limit: 200,
        });
        setItems(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [subjectKind],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setField(initial?.field ?? "password");
    void loadItems("");
  }, [open, initial?.field, loadItems]);

  useEffect(() => {
    if (!open || !initial) return;
    const hit = items.find((item) => item.id === initial.itemId);
    if (hit) setSelected(hit);
  }, [open, initial, items]);

  useEffect(() => {
    if (!open) return () => {};
    const id = window.setTimeout(() => void loadItems(query), 280);
    return () => clearTimeout(id);
  }, [open, query, loadItems]);

  useEffect(() => {
    if (!selected) return;
    const candidates = vaultRefFieldCandidates(selected);
    if (!candidates.includes(field)) {
      setField(candidates[0] ?? "password");
    }
  }, [selected, field]);

  const fieldOptions = selected ? vaultRefFieldCandidates(selected) : [];

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-h-[min(85vh,36rem)] gap-3 overflow-hidden sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>选择 Agent Vault 条目</DialogTitle>
      </DialogHeader>

      <p className="text-xs text-muted-foreground">
        运行时配置与邮箱密码解析固定使用 Agent 库。仍可手写明文或 env(&quot;KEY&quot;)。
      </p>

      <Input placeholder="搜索条目标题…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="h-[min(50vh,20rem)] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-destructive px-1 py-4 text-sm">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-sm">
            {query.trim() ? "没有匹配的条目" : "Agent 库暂无条目"}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`hover:bg-muted w-full rounded-md px-3 py-2 text-left text-sm ${
                    selected?.id === item.id ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => setSelected(item)}
                >
                  <span className="line-clamp-1">{item.title || `条目 #${item.id}`}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    #{item.id}
                    {item.username ? ` · ${item.username}` : ""}
                    {item.item_type ? ` · ${item.item_type}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="space-y-1 border-t pt-3">
          <Label className="text-sm">字段</Label>
          <select
            className="border-input flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            {fieldOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground font-mono">
            {formatVaultRef(selected.id, field)}
          </p>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button
          type="button"
          isDisabled={!selected || !field.trim()}
          onClick={() => {
            if (!selected) return;
            onSelect(selected.id, field.trim());
          }}
        >
          使用此引用
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
