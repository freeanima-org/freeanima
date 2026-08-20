import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
} from "@freeanima/ui-kit";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import {
  createSubjectApiToken,
  getSubjectEntity,
  listWorldEntities,
  type EntityRow,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { COMPONENT_IDS } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
import {
  expandTokenPreset,
  FULL_TOKEN_AUTHORIZATION,
  SERVICE_API_TOKEN_MODULE_OPTIONS,
  type ServiceApiTokenAuthorization,
  type ServiceApiTokenPortal,
  type TokenAuthorizationPreset,
} from "@freeanima/shared/service-api-auth";

type Mode = "full" | "preset" | "custom";

export const Route = createFileRoute("/_sidebar/subjects/$subjectId/tokens/create")({
  loader: async ({ params }) => {
    const subjectId = Number(params.subjectId);
    const [subject, worlds] = await Promise.all([
      getSubjectEntity(subjectId).catch(
        catchWithFallback("tokens/create/getSubject", null as EntityRow | null),
      ),
      listWorldEntities({ limit: 200 }).catch(
        catchWithFallback("tokens/create/listWorlds", { items: [] as EntityRow[], total: 0 }),
      ),
    ]);
    return { subjectId, subject, worlds: worlds.items };
  },
  component: CreateSubjectApiTokenPage,
});

function toggleStringId(prev: string[], id: string): string[] {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
}

function StarOrCheckboxList({
  allLabel,
  allSelected,
  onAllChange,
  options,
  selected,
  onToggle,
  disabled,
}: {
  allLabel: string;
  allSelected: boolean;
  onAllChange: (next: boolean) => void;
  options: readonly string[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          isSelected={allSelected}
          {...(disabled !== undefined ? { isDisabled: disabled } : {})}
          onChange={onAllChange}
          aria-label={allLabel}
        />
        <span>{allLabel}</span>
      </label>
      {!allSelected ? (
        <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-border">
          {options.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm font-mono cursor-pointer">
              <Checkbox
                isSelected={selected.includes(id)}
                {...(disabled !== undefined ? { isDisabled: disabled } : {})}
                onChange={() => onToggle(id)}
                aria-label={id}
              />
              <span>{id}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateSubjectApiTokenPage() {
  const { subjectId, subject, worlds } = Route.useLoaderData();
  const navigate = useNavigate();
  const title = subject?.title?.trim() || `主体 #${subjectId}`;

  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("preset");
  const [preset, setPreset] = useState<TokenAuthorizationPreset>("mcp");
  const [portal, setPortal] = useState<ServiceApiTokenPortal>("mcp");
  const [allModules, setAllModules] = useState(true);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [allComponents, setAllComponents] = useState(true);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [access, setAccess] = useState<"read" | "write">("write");
  const [allWorlds, setAllWorlds] = useState(true);
  const [selectedWorldIds, setSelectedWorldIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState("");

  const previewAuthz = useMemo((): ServiceApiTokenAuthorization => {
    const worldIds = allWorlds ? (["*"] as const) : selectedWorldIds;
    if (mode === "full") return FULL_TOKEN_AUTHORIZATION;
    if (mode === "preset") {
      return expandTokenPreset(
        preset,
        allWorlds || selectedWorldIds.length === 0 ? undefined : { worldIds: selectedWorldIds },
      );
    }
    const modules = allModules ? ["*"] : selectedModules;
    const components = allComponents ? ["*"] : selectedComponents;
    return {
      full: false,
      portal,
      modules: modules.length > 0 ? modules : ["*"],
      data: {
        allowed_components: components.length > 0 ? components : ["*"],
        denied_components: [],
        allowed_worlds: worldIds.length > 0 ? [...worldIds] : ["*"],
        denied_worlds: [],
        access,
      },
    };
  }, [
    access,
    allComponents,
    allModules,
    allWorlds,
    mode,
    portal,
    preset,
    selectedComponents,
    selectedModules,
    selectedWorldIds,
  ]);

  const toggleWorld = (id: number) => {
    setSelectedWorldIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写令牌名称");
      return;
    }
    if (mode === "custom" && !allModules && selectedModules.length === 0) {
      setError("请至少勾选一个模块，或选择「全部模块」");
      return;
    }
    if (mode === "custom" && !allComponents && selectedComponents.length === 0) {
      setError("请至少勾选一个组件，或选择「全部组件」");
      return;
    }
    if (mode !== "full" && !allWorlds && selectedWorldIds.length === 0) {
      setError("请选择至少一个 world，或开启「全部 world」");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const result = await createSubjectApiToken(subjectId, {
        name: trimmed,
        authorization: previewAuthz,
      });
      setPlaintext(result.plaintext);
    } catch (e) {
      logCaughtError("subjects/$subjectId/tokens/create", e);
      setError(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  const onCopy = async () => {
    if (!plaintext) return;
    const ok = await copyText(plaintext);
    setCopyHint(ok ? "已复制" : "复制失败");
  };

  return (
    <div className="space-y-4 p-4 max-w-3xl">
      <div>
        <div className="text-sm text-muted-foreground mb-1">
          <Link to="/subjects" className="underline-offset-2 hover:underline">
            {"主体"}
          </Link>
          {" / "}
          <Link
            to="/subjects/$subjectId/tokens"
            params={{ subjectId: String(subjectId) }}
            className="underline-offset-2 hover:underline"
          >
            {title}
          </Link>
          {" / 创建"}
        </div>
        <h1 className="text-xl font-semibold">{"创建服务 API 令牌"}</h1>
        <p className="text-sm text-muted-foreground">
          {"可选 full / 预设 / 自定义各维；创建后不可改授权，只能吊销重建。"}
        </p>
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {plaintext ? (
        <StatusAlert variant="warning">
          <div className="space-y-2">
            <p className="font-semibold">{"已创建 — 请立即保存明文"}</p>
            <code className="block p-2 rounded bg-muted text-xs break-all">{plaintext}</code>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void onCopy()}>
                {"复制"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigate({
                    to: "/subjects/$subjectId/tokens",
                    params: { subjectId: String(subjectId) },
                  })
                }
              >
                {"返回列表"}
              </Button>
            </div>
            {copyHint ? <p className="text-xs opacity-80">{copyHint}</p> : null}
          </div>
        </StatusAlert>
      ) : (
        <>
          <FormFieldset>
            <FormField label={"名称"}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={"例如 mcp、desktop、extension"}
                disabled={creating}
              />
            </FormField>

            <FormField label={"模式"}>
              <Select
                selectedKey={mode}
                isDisabled={creating}
                onSelectionChange={(key) => {
                  if (key == null) return;
                  setMode(String(key) as Mode);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem id="full">{"full — 全部权限（可管令牌）"}</SelectItem>
                  <SelectItem id="preset">{"预设 — app / extension / mcp"}</SelectItem>
                  <SelectItem id="custom">
                    {"自定义 — 入口 / 模块 / 组件 / 读写 / world"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {mode === "preset" ? (
              <FormField label={"预设"}>
                <Select
                  selectedKey={preset}
                  isDisabled={creating}
                  onSelectionChange={(key) => {
                    if (key == null) return;
                    setPreset(String(key) as TokenAuthorizationPreset);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="app">{"app — 主壳业务全开（非 full）"}</SelectItem>
                    <SelectItem id="extension">{"extension — 浏览器扩展白名单"}</SelectItem>
                    <SelectItem id="mcp">{"mcp — MCP 客户端"}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}

            {mode === "custom" ? (
              <>
                <FormField label={"入口 portal"}>
                  <Select
                    selectedKey={portal}
                    isDisabled={creating}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      setPortal(String(key) as ServiceApiTokenPortal);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="app">{"app"}</SelectItem>
                      <SelectItem id="extension">{"extension"}</SelectItem>
                      <SelectItem id="mcp">{"mcp"}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={"模块 modules"}>
                  <StarOrCheckboxList
                    allLabel={"全部模块（*）"}
                    allSelected={allModules}
                    onAllChange={setAllModules}
                    options={SERVICE_API_TOKEN_MODULE_OPTIONS}
                    selected={selectedModules}
                    onToggle={(id) => setSelectedModules((prev) => toggleStringId(prev, id))}
                    disabled={creating}
                  />
                </FormField>
                <FormField label={"组件 components"}>
                  <StarOrCheckboxList
                    allLabel={"全部组件（*）"}
                    allSelected={allComponents}
                    onAllChange={setAllComponents}
                    options={COMPONENT_IDS}
                    selected={selectedComponents}
                    onToggle={(id) => setSelectedComponents((prev) => toggleStringId(prev, id))}
                    disabled={creating}
                  />
                </FormField>
                <FormField label={"数据读写"}>
                  <Select
                    selectedKey={access}
                    isDisabled={creating}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      setAccess(String(key) === "read" ? "read" : "write");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="read">{"read"}</SelectItem>
                      <SelectItem id="write">{"write（含 read）"}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            ) : null}

            {mode !== "full" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">{"全部 world（与 subject grants 再求交）"}</Label>
                  <Switch isSelected={allWorlds} onChange={setAllWorlds} isDisabled={creating} />
                </div>
                {!allWorlds ? (
                  <div className="rounded-md border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                    {worlds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{"暂无 world"}</p>
                    ) : (
                      worlds.map((w) => (
                        <label
                          key={w.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedWorldIds.includes(w.id)}
                            disabled={creating}
                            onChange={() => toggleWorld(w.id)}
                          />
                          <span>
                            {"#"}
                            {w.id} {w.title || "（无标题）"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </FormFieldset>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold mb-1">{"将写入的 authorization"}</p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(previewAuthz, null, 2)}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              isDisabled={creating || !name.trim()}
              onClick={() => void onSubmit()}
            >
              {creating ? <Spinner /> : "创建"}
            </Button>
            <Link
              to="/subjects/$subjectId/tokens"
              params={{ subjectId: String(subjectId) }}
              className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
            >
              {"取消"}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
