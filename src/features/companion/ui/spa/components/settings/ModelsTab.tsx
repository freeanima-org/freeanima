import { useState, type ChangeEvent } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
} from "@freeanima/ui-kit";
import { showConfirm } from "@freeanima/ui-kit/composite";
import {
  deleteModel,
  renameModel,
  setActiveModel,
} from "@freeanima/features/companion/ui/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import { emitConfigChanged } from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";

export function ModelsTab() {
  const models = useCompanionStore((s) => s.models);
  const activeModelId = useCompanionStore((s) => s.activeModelId);
  const uploadModel = useCompanionStore((s) => s.uploadModel);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onImport = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadModel(file);
      await emitConfigChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string, name: string): Promise<void> => {
    const ok = await showConfirm({
      title: "删除确认",
      description: `确定删除模型「${name}」？此操作不可恢复。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    await deleteModel(id);
    await refreshConfig();
    await emitConfigChanged();
  };

  return (
    <div className="flex flex-col gap-4">
      <Button asChild className="w-full" disabled={uploading}>
        <label className="cursor-pointer">
          {uploading ? <Spinner className="size-4" /> : null}
          {uploading ? "导入中…" : "导入 VRM 模型"}
          <input
            type="file"
            accept=".vrm"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void onImport(e)}
          />
        </label>
      </Button>
      {error ? (
        <Alert variant="error" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-2">
        {models.length === 0 ? (
          <li className="text-center text-sm text-muted-foreground py-6">暂无模型</li>
        ) : (
          models.map((m) => (
            <li key={m.id}>
              <Card className="gap-0 border bg-muted/30 py-0 shadow-none">
                <CardContent className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      className="h-auto min-h-0 flex-1 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                      defaultValue={m.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== m.name) {
                          void renameModel(m.id, name).then(() => refreshConfig());
                        }
                      }}
                    />
                    {m.id === activeModelId ? (
                      <Badge variant="success" className="shrink-0">
                        当前
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() =>
                          void setActiveModel(m.id)
                            .then(() => refreshConfig())
                            .then(() => emitConfigChanged())
                        }
                      >
                        切换
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate" title={m.id}>
                    {m.id}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 self-start px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => void onDelete(m.id, m.name)}
                  >
                    删除
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
