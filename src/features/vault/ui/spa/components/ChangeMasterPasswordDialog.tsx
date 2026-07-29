import { useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Spinner,
} from "@freeanima/ui-kit";

export function ChangeMasterPasswordDialog({
  open,
  loading,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      className="max-w-md safe-area-pt safe-area-pb"
    >
      <DialogHeader>
        <DialogTitle>修改主密码</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm text-muted-foreground">
          主密码只在本机用于解锁用户保险库，不会上传明文。修改后请用新密码解锁。
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <FormField label="当前主密码">
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            disabled={loading}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </FormField>
        <FormField label="新主密码" hint="至少 8 个字符">
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            disabled={loading}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </FormField>
        <FormField label="确认新主密码">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            disabled={loading}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => {
            reset();
            onOpenChange(false);
          }}
        >
          取消
        </Button>
        <Button
          type="button"
          disabled={
            loading || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()
          }
          onClick={() =>
            onSubmit({
              currentPassword,
              newPassword,
              confirmPassword,
            })
          }
        >
          {loading ? <Spinner className="size-4" /> : "保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
