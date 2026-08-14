import { useCallback, useEffect, useState } from "react";
import { getUserVaultSession } from "@freeanima/client/portal-sdk/react.tsx";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  cn,
} from "@freeanima/ui-kit";

import { ensureAgentRootKeySsot } from "@freeanima/features/vault/ui/spa/lib/agent-root-key-custody.ts";
import { getVaultCryptoConfig } from "@freeanima/features/chat/ui/spa/lib/vault-unlock-api.ts";

/** bundled Shell Chat（/web/chat）内专用 User 库解锁控件；主密码不进消息流 */
export function isBundledShellChat(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.appUi === "1";
}

export function VaultUnlockButton({
  conversationId,
  className,
}: {
  conversationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const refreshUnlocked = useCallback(() => {
    if (!conversationId) {
      setUnlocked(false);
      return;
    }
    setUnlocked(getUserVaultSession().isUnlocked(conversationId));
  }, [conversationId]);

  useEffect(() => {
    refreshUnlocked();
  }, [conversationId, refreshUnlocked]);

  useEffect(() => {
    if (!conversationId) {
      getUserVaultSession().lock();
      setUnlocked(false);
    }
  }, [conversationId]);

  if (!isBundledShellChat() || !conversationId) return null;

  const handleUnlock = async () => {
    const mp = password.trim();
    if (!mp) return;
    setLoading(true);
    setError("");
    try {
      const config = await getVaultCryptoConfig("user");
      if (!config?.salt || !config.verifier) {
        throw new Error("请先在保险库中设置用户主密码");
      }
      await getUserVaultSession().unlock({
        masterPassword: mp,
        salt: config.salt,
        verifier: config.verifier,
        conversationId,
      });
      setPassword("");
      setOpen(false);
      setUnlocked(true);
      try {
        await ensureAgentRootKeySsot();
      } catch {
        // Agent 根密钥迁入失败不阻断 Chat 解锁；可在密码库/数据维护重试
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    if (conversationId) getUserVaultSession().lock(conversationId);
    setUnlocked(false);
  };

  return (
    <>
      {unlocked ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("h-9 shrink-0", className)}
          onClick={handleLock}
        >
          已解锁用户库
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("h-9 shrink-0", className)}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          解锁用户库
        </Button>
      )}
      <Dialog isOpen={open} onOpenChange={setOpen} showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>解锁用户保险库</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">主密码仅在本机验证，不会作为聊天消息发送。</p>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="主密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleUnlock();
          }}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            isDisabled={loading || !password.trim()}
            onClick={() => void handleUnlock()}
          >
            {loading ? <Spinner className="size-4" /> : "解锁"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
