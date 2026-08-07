import { useState } from "react";
import { Button, Input, Spinner, cn } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";

export function VaultUnlockForm({
  loading,
  error,
  setupMode,
  onUnlock,
  onSetup,
  className,
}: {
  loading: boolean;
  error: string;
  setupMode: boolean;
  onUnlock: (password: string) => void;
  onSetup: (password: string, confirm: string) => void;
  className?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <div className={cn("mx-auto flex max-w-md flex-col justify-center gap-4 p-6", className)}>
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">用户保险库已锁定</h1>
        <p className="text-sm text-muted-foreground">
          {setupMode ? "首次使用请设置主密码" : "输入主密码以解锁用户保险库"}
        </p>
      </div>
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="主密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || loading) return;
          if (setupMode) onSetup(password, confirm);
          else onUnlock(password);
        }}
      />
      {setupMode ? (
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="确认主密码"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) onSetup(password, confirm);
          }}
        />
      ) : null}
      <Button
        type="button"
        disabled={loading || !password || (setupMode && !confirm)}
        onClick={() => (setupMode ? onSetup(password, confirm) : onUnlock(password))}
      >
        {loading ? <Spinner className="size-4" /> : setupMode ? "创建保险库" : "解锁"}
      </Button>
    </div>
  );
}
