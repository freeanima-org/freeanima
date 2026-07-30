import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Input,
  Label,
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
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/subagents")({
  loader: () =>
    listHabitatSubagents("agent").catch(
      catchWithFallback("subagents/list", { items: [] as HabitatSubagentRow[] }),
    ),
  staleTime: 30_000,
  component: SubagentsPage,
});

const emptyForm = {
  slug: "",
  title: "",
  summary: "",
  content: "",
  skills: "",
  max_turns: "",
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
      const data = await listHabitatSubagents("agent");
      setItems(data.items ?? []);
    } catch (e) {
      logCaughtError("subagents/reload", e);
      setError(m.habitat_common_load_failed_short());
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
      max_turns: row.max_turns != null ? String(row.max_turns) : "",
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
        subject_kind: "agent" as const,
        slug: form.slug.trim(),
        title: form.title.trim() || form.slug.trim(),
        summary: form.summary,
        content: form.content,
        skills: splitCsv(form.skills),
        max_turns: form.max_turns.trim() ? Number(form.max_turns) : null,
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
      await deleteHabitatSubagent("agent", id);
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
        <h1 className="text-xl font-semibold">{m.habitat_nav_subagents()}</h1>
        <p className="text-sm text-muted-foreground">{m.habitat_subagents_intro()}</p>
      </div>
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {items.length === 0 ? (
        <StatusAlert variant="info">{m.habitat_subagents_empty()}</StatusAlert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.habitat_subagents_col_slug()}</TableHead>
              <TableHead>{m.habitat_subagents_col_title()}</TableHead>
              <TableHead>{m.habitat_subagents_col_tools()}</TableHead>
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
                    {m.habitat_common_edit()}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={busy}
                    onPress={() => void remove(row.id)}
                  >
                    {m.habitat_common_delete()}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">
            {editingId != null ? m.habitat_subagents_edit() : m.habitat_subagents_create()}
          </h2>
          {editingId != null ? (
            <Button size="sm" variant="ghost" onPress={startCreate}>
              {m.habitat_subagents_new()}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{m.habitat_subagents_col_slug()}</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{m.habitat_subagents_col_title()}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{m.habitat_subagents_field_summary()}</Label>
            <Input
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{m.habitat_subagents_field_content()}</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
            />
          </div>
          <div className="space-y-1">
            <Label>{m.habitat_subagents_field_skills()}</Label>
            <Input
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              placeholder="skill-a, skill-b"
            />
          </div>
          <div className="space-y-1">
            <Label>{m.habitat_subagents_field_max_turns()}</Label>
            <Input
              value={form.max_turns}
              onChange={(e) => setForm((f) => ({ ...f, max_turns: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{m.habitat_subagents_field_allowed()}</Label>
            <Textarea
              value={form.allowed_tools}
              onChange={(e) => setForm((f) => ({ ...f, allowed_tools: e.target.value }))}
              rows={2}
              placeholder="@memory, file_read"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{m.habitat_subagents_field_denied()}</Label>
            <Textarea
              value={form.denied_tools}
              onChange={(e) => setForm((f) => ({ ...f, denied_tools: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{m.habitat_subagents_field_prompt_includes()}</Label>
            <Input
              value={form.prompt_includes}
              onChange={(e) => setForm((f) => ({ ...f, prompt_includes: e.target.value }))}
              placeholder="self, world, time"
            />
          </div>
        </div>
        <Button isDisabled={busy || !form.slug.trim()} onPress={() => void save()}>
          {m.habitat_common_save()}
        </Button>
      </div>
    </div>
  );
}
