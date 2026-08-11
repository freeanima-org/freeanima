import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  getUserVaultSession,
  SubjectScopeToggle,
  useSubjectScope,
  VAULT_UI_SCOPE,
} from "@freeanima/client/portal-sdk/react.tsx";
import { BitwardenImportDialog } from "@freeanima/features/vault/ui/spa/components/BitwardenImportDialog.tsx";
import { UnlockAgentVaultDialog } from "@freeanima/features/vault/ui/spa/components/UnlockAgentVaultDialog.tsx";
import { DidaImportDialog } from "@freeanima/features/task/ui/spa/components/DidaImportDialog.tsx";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar/data-maintenance")({
  component: DataMaintenancePage,
});

function DataMaintenancePage() {
  const { kind: subjectKind } = useSubjectScope();
  const userUnlocked = subjectKind === "user" && getUserVaultSession().isUnlocked(VAULT_UI_SCOPE);
  const [bwOpen, setBwOpen] = useState(false);
  const [didaOpen, setDidaOpen] = useState(false);
  const [agentVaultOpen, setAgentVaultOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{m.habitat_nav_data_maintenance()}</h1>
        <SubjectScopeToggle />
      </div>
      <p className="text-muted-foreground text-sm">
        集中管理第三方数据导入。密码库导入需要先在「密码库」解锁用户主密码。
      </p>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="font-medium">{m.habitat_data_agent_vault_title()}</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {m.habitat_data_agent_vault_desc()}
            </p>
          </div>
          <Button type="button" className="self-start" onClick={() => setAgentVaultOpen(true)}>
            {m.habitat_data_agent_vault_open()}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="font-medium">密码库 · Bitwarden</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              导入 Bitwarden 未加密 JSON 导出。写入当前 Subject 对应库（用户库需已解锁）。
            </p>
          </div>
          {subjectKind === "user" && !userUnlocked ? (
            <StatusAlert variant="warning">请先在 Portal「密码库」解锁后再导入。</StatusAlert>
          ) : null}
          <Button
            type="button"
            className="self-start"
            isDisabled={subjectKind === "user" && !userUnlocked}
            onClick={() => setBwOpen(true)}
          >
            导入 Bitwarden JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="font-medium">任务 · 滴答清单</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              导入滴答 Web CSV 备份（清单树、任务、提醒、重复、时段）。默认写入用户 World。
            </p>
          </div>
          <Button type="button" className="self-start" onClick={() => setDidaOpen(true)}>
            从滴答清单导入 CSV
          </Button>
        </CardContent>
      </Card>

      <UnlockAgentVaultDialog open={agentVaultOpen} onOpenChange={setAgentVaultOpen} />
      <BitwardenImportDialog
        open={bwOpen}
        subjectKind={subjectKind}
        disabled={subjectKind === "user" && !userUnlocked}
        onOpenChange={setBwOpen}
        onDone={async () => {}}
      />
      <DidaImportDialog
        open={didaOpen}
        subjectKind={subjectKind}
        disabled={false}
        onOpenChange={setDidaOpen}
      />
    </div>
  );
}
