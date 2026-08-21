import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  createHabitatSubagent,
  deleteHabitatSubagent,
  listHabitatSubagents,
  patchHabitatSubagent,
  type HabitatSubagentRow,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/subagents")({
  loader: () =>
    listHabitatSubagents().catch(
      catchWithFallback("subagents/list", { items: [] as HabitatSubagentRow[] }),
    ),
  staleTime: 30_000,
  component: SubagentsPage,
});

const TIER_NONE = "__none__";
const TEMPERATURE_TIERS = ["focused", "balanced", "creative"] as const;
function isTemperatureTier(v: string): v is (typeof TEMPERATURE_TIERS)[number] {
  return (TEMPERATURE_TIERS as readonly string[]).includes(v);
}
const TEMPERATURE_TIER_OPTIONS = [
  { id: "focused", label: "专注" },
  { id: "balanced", label: "平衡" },
  { id: "creative", label: "发散" },
] as const;

const emptyForm = {
  slug: "",
  title: "",
  summary: "",
  content: "",
  skills: "",
  max_loop_iterations: "",
  temperature_tier: "" as "" | "focused" | "balanced" | "creative",
  allowed_tools: "",
  denied_tools: "",
  prompt_includes: "",
};

function splitCsv(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function SubagentsPage() {
  const initial = Route.useLoaderData();
  const [items, setItems] = useState<HabitatSubagentRow[]>(initial.items ?? []);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const data = await listHabitatSubagents();
      setItems(data.items ?? []);
    } catch (e) {
      logCaughtError("subagents/reload", e);
      setError("加载失败");
    }
  };

  const startEdit = (row: HabitatSubagentRow) => {
    setEditingId(row.id);
    setForm({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      content: row.content,
      skills: row.skills.join(", "),
      max_loop_iterations: row.max_loop_iterations != null ? String(row.max_loop_iterations) : "",
      temperature_tier: row.temperature_tier ?? "",
      allowed_tools: row.allowed_tools.join(", "),
      denied_tools: row.denied_tools.join(", "),
      prompt_includes: (row.prompt_includes ?? []).join(", "),
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim() || form.slug.trim(),
        summary: form.summary,
        content: form.content,
        skills: splitCsv(form.skills),
        max_loop_iterations: form.max_loop_iterations.trim()
          ? Number(form.max_loop_iterations)
          : null,
        temperature_tier: form.temperature_tier || null,
        allowed_tools: splitCsv(form.allowed_tools),
        denied_tools: splitCsv(form.denied_tools),
        prompt_includes: splitCsv(form.prompt_includes).filter(
          (x): x is "self" | "world" | "time" => x === "self" || x === "world" || x === "time",
        ),
      };
      if (editingId != null) {
        await patchHabitatSubagent({ id: editingId, ...payload });
      } else {
        await createHabitatSubagent(payload);
      }
      await reload();
      startCreate();
    } catch (e) {
      logCaughtError("subagents/save", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await deleteHabitatSubagent(id);
      await reload();
      if (editingId === id) startCreate();
    } catch (e) {
      logCaughtError("subagents/delete", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{"子代理"}</h1>
        <p className="text-sm text-muted-foreground">
          {
            "命名子代理档案存为 entity。allowed_tools 为硬天花板；运行时物化固定 tools 列表（禁止 toolset_load）。"
          }
        </p>
      </div>
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {items.length === 0 ? (
        <StatusAlert variant="info">{"尚无子代理档案。"}</StatusAlert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{"Slug"}</TableHead>
              <TableHead>{"标题"}</TableHead>
              <TableHead>{"工具"}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.slug}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  allow={row.allowed_tools.length} deny={row.denied_tools.length}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="ghost" onPress={() => startEdit(row)}>
                    {"编辑"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={busy}
                    onPress={() => void remove(row.id)}
                  >
                    {"删除"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{editingId != null ? "编辑子代理" : "创建子代理"}</h2>
          {editingId != null ? (
            <Button size="sm" variant="ghost" onPress={startCreate}>
              {"新建"}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{"Slug"}</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{"标题"}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{"描述"}</Label>
            <Input
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{"系统提示补充"}</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
            />
          </div>
          <div className="space-y-1">
            <Label>{"Skills（逗号分隔）"}</Label>
            <Input
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              placeholder="skill-a, skill-b"
            />
          </div>
          <div className="space-y-1">
            <Label>{"最大引擎轮"}</Label>
            <Input
              value={form.max_loop_iterations}
              onChange={(e) => setForm((f) => ({ ...f, max_loop_iterations: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{"采样档位"}</Label>
            <Select
              selectedKey={form.temperature_tier || TIER_NONE}
              onSelectionChange={(key) => {
                if (key == null) return;
                const v = String(key);
                setForm((f) => ({
                  ...f,
                  temperature_tier: v === TIER_NONE ? "" : isTemperatureTier(v) ? v : "",
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id={TIER_NONE}>{"（系统默认）"}</SelectItem>
                {TEMPERATURE_TIER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} id={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{"允许工具（@ToolSet 或工具名）"}</Label>
            <Textarea
              value={form.allowed_tools}
              onChange={(e) => setForm((f) => ({ ...f, allowed_tools: e.target.value }))}
              rows={2}
              placeholder="@memory, file_read"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{"拒绝工具"}</Label>
            <Textarea
              value={form.denied_tools}
              onChange={(e) => setForm((f) => ({ ...f, denied_tools: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{"提示词旁路（可选：self, world, time）"}</Label>
            <Input
              value={form.prompt_includes}
              onChange={(e) => setForm((f) => ({ ...f, prompt_includes: e.target.value }))}
              placeholder="self, world, time"
            />
          </div>
        </div>
        <Button isDisabled={busy || !form.slug.trim()} onPress={() => void save()}>
          {"保存"}
        </Button>
      </div>
    </div>
  );
}
