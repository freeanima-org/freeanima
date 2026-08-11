import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getUserVaultSession } from "@freeanima/client/portal-sdk/react.tsx";
import {
  lockAgentVaultCustody,
  migrateAgentRootKeySsotIfNeeded,
  unlockAgentVaultFromUserCustody,
} from "@freeanima/features/vault/domain/agent-root-key-custody.ts";
import { m } from "@paraglide/messages";
import { fetchAgentVaultKeyStatus } from "@freeanima/features/vault/ui/spa/lib/api.ts";

export function UnlockAgentVaultDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const userUnlocked = getUserVaultSession().isUnlocked();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshStatus(): Promise<void> {
    setLoadingStatus(true);
    setError("");
    try {
      const status = await fetchAgentVaultKeyStatus();
      setUnlocked(status.unlocked);
      if (status.unlocked && getUserVaultSession().isUnlocked()) {
        try {
          // 已解锁时只迁入、不生成，避免与 Habitat 缓存不同步
          await migrateAgentRootKeySsotIfNeeded();
        } catch (migrateErr) {
          // 迁移失败不阻断状态展示；解锁路径仍可重试
          setError(migrateErr instanceof Error ? migrateErr.message : String(migrateErr));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUnlocked(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
  }, [open]);

  async function onUnlock(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await unlockAgentVaultFromUserCustody();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLock(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await lockAgentVaultCustody();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const statusText =
    unlocked === null
      ? "…"
      : unlocked
        ? m.habitat_data_agent_vault_status_unlocked()
        : m.habitat_data_agent_vault_status_locked();

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-w-md safe-area-pt safe-area-pb"
    >
      <DialogHeader>
        <DialogTitle>{m.habitat_data_agent_vault_dialog_title()}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <p className="text-muted-foreground text-sm">{m.habitat_data_agent_vault_desc()}</p>
        <p className="text-sm">
          {m.habitat_data_agent_vault_status_label()}:{" "}
          <span className="font-medium">
            {loadingStatus ? <Spinner className="inline size-4" /> : statusText}
          </span>
        </p>
        {!userUnlocked ? (
          <StatusAlert variant="warning">{m.habitat_data_agent_vault_need_user()}</StatusAlert>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
      <DialogFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || loadingStatus}
          onClick={() => void refreshStatus()}
        >
          {m.habitat_data_agent_vault_refresh()}
        </Button>
        {unlocked ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void onLock()}>
            {busy ? m.habitat_data_agent_vault_locking() : m.habitat_data_agent_vault_lock_action()}
          </Button>
        ) : null}
        {/* 未解锁时必须提供解锁操作；已解锁时不再显示解锁主按钮 */}
        {unlocked !== true ? (
          <Button type="button" disabled={busy || !userUnlocked} onClick={() => void onUnlock()}>
            {busy
              ? m.habitat_data_agent_vault_unlocking()
              : m.habitat_data_agent_vault_unlock_action()}
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
