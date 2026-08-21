import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Textarea,
} from "@freeanima/ui-kit";
import { FormField } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  createCronJob,
  listSubjectEntities,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

type CronJob = Record<string, unknown> & { id: string; name?: string; paused?: boolean };

type AgentOption = { id: number; title: string };

function formatAgentLabel(id: number, title: string): string {
  const trimmed = title.trim();
  return trimmed || `#${id}`;
}

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
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsReady, setAgentsReady] = useState(false);
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const subjects = await listSubjectEntities({ limit: 500 });
        if (cancelled) return;
        const next: AgentOption[] = [];
        for (const row of subjects.items) {
          if (row.type !== "agent") continue;
          if (!Number.isInteger(row.id) || row.id <= 0) continue;
          next.push({
            id: row.id,
            title: typeof row.title === "string" ? row.title.trim() : "",
          });
        }
        setAgents(next);
      } catch (e) {
        if (!cancelled) {
          logCaughtError("routes/_sidebar/cron-create-dialog agents", e);
          setAgents([]);
        }
      } finally {
        if (!cancelled) setAgentsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    name.trim().length > 0 &&
    schedule.trim().length > 0 &&
    prompt.trim().length > 0 &&
    subjectId != null &&
    subjectId > 0;

  const onSubmit = async () => {
    if (!canSubmit || saving || subjectId == null) return;
    setSaving(true);
    setError("");
    try {
      const data = await createCronJob({
        name: name.trim(),
        schedule: schedule.trim(),
        prompt: prompt.trim(),
        subject_id: subjectId,
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
        <FormField label="Anima" className="text-xs">
          <Select
            selectedKey={subjectId != null ? String(subjectId) : null}
            isDisabled={saving || !agentsReady || agents.length === 0}
            aria-label="选择执行 Anima"
            onSelectionChange={(key) => {
              if (key == null) {
                setSubjectId(null);
                return;
              }
              const id = Number(String(key));
              if (!Number.isInteger(id) || id <= 0) return;
              setSubjectId(id);
            }}
          >
            <SelectTrigger className="w-full h-8">
              <SelectValue
                placeholder={
                  !agentsReady
                    ? "加载 Anima…"
                    : agents.length === 0
                      ? "暂无可用 Anima"
                      : "选择 Anima"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} id={String(a.id)}>
                  {formatAgentLabel(a.id, a.title)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
