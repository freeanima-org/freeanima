import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import type { SubjectKind } from "@freeanima/client/portal-sdk";
import { getUserVaultSession, VAULT_UI_SCOPE } from "@freeanima/client/portal-sdk/react.tsx";
import { BitwardenImportDialog } from "@freeanima/features/vault/ui/spa/components/BitwardenImportDialog.tsx";
import { UnlockAgentVaultDialog } from "@freeanima/features/vault/ui/spa/components/UnlockAgentVaultDialog.tsx";
import { DidaImportDialog } from "@freeanima/features/task/ui/spa/components/DidaImportDialog.tsx";
import { FtsIndexPanel } from "@freeanima/features/habitat/ui/habitat/components/habitat/FtsIndexPanel.tsx";
import { MemoryPipelineOpsCard } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryPipelineOpsCard.tsx";

export const Route = createFileRoute("/_sidebar/data-maintenance")({
  component: DataMaintenancePage,
});

function DataMaintenancePage() {
  const userUnlocked = getUserVaultSession().isUnlocked(VAULT_UI_SCOPE);
  const [bwOpen, setBwOpen] = useState(false);
  const [didaOpen, setDidaOpen] = useState(false);
  const [didaSubjectKind, setDidaSubjectKind] = useState<SubjectKind>("user");
  const [agentVaultOpen, setAgentVaultOpen] = useState(false);
  const [ftsOpen, setFtsOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{"🧰 数据维护"}</h1>
      <p className="text-muted-foreground text-sm">
        {"导入、索引与记忆维护入口。密码库导入需先在「密码库」解锁用户主密码。"}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <MemoryPipelineOpsCard />
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
            <div className="min-h-0 flex-1">
              <h2 className="text-sm font-medium">{"全文检索索引"}</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {"查看 FTS / 分词 / 向量覆盖度，后台重建（默认补缺失）。"}
              </p>
            </div>
            <Button type="button" size="sm" className="self-start" onClick={() => setFtsOpen(true)}>
              {"打开全文检索"}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
            <div className="min-h-0 flex-1">
              <h2 className="text-sm font-medium">{"Agent 密码库"}</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {"解锁后写入可重建缓存，工具与 cron 才能解密 Agent 库。"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="self-start"
              onClick={() => setAgentVaultOpen(true)}
            >
              {"解锁 agent 密码库"}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
            <div className="min-h-0 flex-1">
              <h2 className="text-sm font-medium">{"密码库 · Bitwarden"}</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {"导入未加密 JSON 导出到用户密码库。"}
              </p>
              {!userUnlocked ? (
                <StatusAlert variant="warning" className="mt-2">
                  {"请先在 Portal「密码库」解锁用户主密码。"}
                </StatusAlert>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              className="self-start"
              isDisabled={!userUnlocked}
              onClick={() => setBwOpen(true)}
            >
              {"导入 Bitwarden JSON"}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
            <div className="min-h-0 flex-1">
              <h2 className="text-sm font-medium">{"任务 · 滴答清单"}</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {"导入滴答 Web CSV（清单树、任务、提醒、重复）。"}
              </p>
            </div>
            <FormFieldset bordered={false} className="gap-2">
              <FormField label={"写入主体"} className="text-xs">
                <Select
                  selectedKey={didaSubjectKind}
                  onSelectionChange={(key) => {
                    if (key === "user" || key === "agent") setDidaSubjectKind(key);
                  }}
                >
                  <SelectTrigger size="sm" className="w-full max-w-[12rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="user">{"用户"}</SelectItem>
                    <SelectItem id="agent">{"Agent"}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </FormFieldset>
            <Button
              type="button"
              size="sm"
              className="self-start"
              onClick={() => setDidaOpen(true)}
            >
              {"从滴答清单导入 CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        isOpen={ftsOpen}
        onOpenChange={setFtsOpen}
        className="max-w-4xl w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] flex flex-col overflow-hidden safe-area-pt safe-area-pb"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{"🔍 全文检索"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FtsIndexPanel active={ftsOpen} />
        </div>
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => setFtsOpen(false)}>
            {"关闭"}
          </Button>
        </DialogFooter>
      </Dialog>

      <UnlockAgentVaultDialog open={agentVaultOpen} onOpenChange={setAgentVaultOpen} />
      <BitwardenImportDialog
        open={bwOpen}
        subjectKind="user"
        disabled={!userUnlocked}
        onOpenChange={setBwOpen}
        onDone={async () => {}}
      />
      <DidaImportDialog
        open={didaOpen}
        subjectKind={didaSubjectKind}
        disabled={false}
        onOpenChange={setDidaOpen}
      />
    </div>
  );
}
