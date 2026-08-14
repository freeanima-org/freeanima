import { useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
  Switch,
  Textarea,
} from "@freeanima/ui-kit";
import { FormField } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { createCronJob } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

type CronJob = Record<string, unknown> & { id: string; name?: string; paused?: boolean };

export function CronCreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (job: CronJob) => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    name.trim().length > 0 && schedule.trim().length > 0 && prompt.trim().length > 0;

  const onSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await createCronJob({
        name: name.trim(),
        schedule: schedule.trim(),
        prompt: prompt.trim(),
        notify_on_success: notifyOnSuccess,
      });
      const job = (data as { job?: CronJob }).job;
      if (job) onCreated(job);
      else onClose();
    } catch (e) {
      logCaughtError("routes/_sidebar/cron-create-dialog", e);
      setError(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
      className="max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <DialogHeader>
        <DialogTitle>{"新建定时任务"}</DialogTitle>
      </DialogHeader>
      {error ? (
        <StatusAlert variant="error" className="mb-3">
          {error}
        </StatusAlert>
      ) : null}
      <div className="space-y-3">
        <FormField label="名称" className="text-xs">
          <Input
            type="text"
            className="w-full h-8"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="每日摘要"
            disabled={saving}
            focusOnMount
          />
        </FormField>
        <FormField label="调度" className="text-xs">
          <Input
            type="text"
            className="w-full h-8 font-mono text-sm"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="30m / every 2h / 0 9 * * *"
            disabled={saving}
          />
        </FormField>
        <FormField label="提示词" className="text-xs">
          <Textarea
            className="w-full min-h-24"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="每次触发时发给 Agent 的提示词"
            disabled={saving}
            rows={5}
          />
        </FormField>
        <div className="flex items-center gap-2">
          <Switch
            id="cron-notify-on-success"
            isSelected={notifyOnSuccess}
            isDisabled={saving}
            onChange={setNotifyOnSuccess}
          />
          <Label htmlFor="cron-notify-on-success" className="text-sm">
            {"成功时通知"}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {"脚本-only 任务请用 ToolSet "}
          <code className="text-xs">cronjob</code>
          {" 的 "}
          <code className="text-xs">cronjob_create</code>
          {"（"}
          <code className="text-xs">no_agent</code>
          {" + "}
          <code className="text-xs">script</code>
          {"）。"}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" isDisabled={saving} onClick={onClose}>
          {"取消"}
        </Button>
        <Button
          type="button"
          size="sm"
          isDisabled={saving || !canSubmit}
          onClick={() => void onSubmit()}
        >
          {saving ? <Spinner /> : null}
          {"创建"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
