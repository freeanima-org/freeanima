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
} from "@freeanima/features/vault/ui/spa/lib/agent-root-key-custody.ts";
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

  const statusText = unlocked === null ? "…" : unlocked ? "已解锁" : "未解锁";

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-w-md safe-area-pt safe-area-pb"
    >
      <DialogHeader>
        <DialogTitle>{"解锁 agent 密码库"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <p className="text-muted-foreground text-sm">
          {
            "根密钥保存在用户密码库（主密码保护）。解锁后写入 Habitat 可重建缓存，工具与 cron 才能解密 Agent 库。"
          }
        </p>
        <p className="text-sm">
          {"本地状态"}:{" "}
          <span className="font-medium">
            {loadingStatus ? <Spinner className="inline size-4" /> : statusText}
          </span>
        </p>
        {!userUnlocked ? (
          <StatusAlert variant="warning">{"请先在 Portal「密码库」解锁用户主密码。"}</StatusAlert>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
      <DialogFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          isDisabled={busy || loadingStatus}
          onClick={() => void refreshStatus()}
        >
          {"刷新状态"}
        </Button>
        {unlocked ? (
          <Button type="button" variant="outline" isDisabled={busy} onClick={() => void onLock()}>
            {busy ? "锁定中…" : "锁定"}
          </Button>
        ) : null}
        {/* 未解锁时必须提供解锁操作；已解锁时不再显示解锁主按钮 */}
        {unlocked !== true ? (
          <Button type="button" isDisabled={busy || !userUnlocked} onClick={() => void onUnlock()}>
            {busy ? "解锁中…" : "解锁"}
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
