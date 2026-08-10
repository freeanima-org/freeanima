/**
 * 滴答清单 Web CSV 备份（Version 7.x）→ FreeAnima 导入 plan。
 * 幂等键：client_op_id = dida:<taskId> / dida:folder:<name> / dida:list:<folder>/<list>
 */

import type { TaskItemPriority } from "@freeanima/host/core/db/schema/entity";
import type { TaskRecurrenceInput } from "@freeanima/host/core/db/schema/entity/task-recurrence.ts";
import { formatCstIso } from "@freeanima/host/core/util";

import { parseDidaRepeat } from "./dida-rrule.ts";
import { clampSortOrder } from "./sort-order.ts";

export type DidaCsvMappedList = {
  client_op_id: string;
  name: string;
  is_folder: boolean;
  /** 文件夹 client_op_id；根清单为 null */
  parent_folder_op_id: string | null;
};

export type DidaCsvMappedTask = {
  client_op_id: string;
  title: string;
  content: string;
  tags: string[];
  list_client_op_id: string;
  parent_task_op_id: string | null;
  priority: TaskItemPriority;
  status: "pending" | "completed";
  start_at: string | null;
  due_at: string | null;
  reminders: Array<{ at: string }>;
  recurrence: TaskRecurrenceInput | null;
  sort_order: number;
  warnings: string[];
};

/** 跳过行（如 Status=-1 已放弃），仅供预览，不写入 */
export type DidaCsvSkippedTask = {
  client_op_id: string;
  title: string;
  list_name: string;
  folder_name: string;
  reason: string;
};

export type DidaCsvParseResult =
  | {
      ok: true;
      version: string | null;
      lists: DidaCsvMappedList[];
      tasks: DidaCsvMappedTask[];
      skipped_tasks: DidaCsvSkippedTask[];
      skipped_abandoned: number;
      warnings: string[];
    }
  | { ok: false; error: string };

export type DidaImportMode = "upsert" | "create_only";

export type DidaImportPlanAction = "create" | "update" | "skip";

export type DidaImportPlanEntry =
  | {
      kind: "folder" | "list";
      action: DidaImportPlanAction;
      mapped: DidaCsvMappedList;
      local_id?: number;
      reason?: string;
    }
  | {
      kind: "task";
      action: DidaImportPlanAction;
      mapped: DidaCsvMappedTask;
      local_id?: number;
      reason?: string;
    };

const PRIORITY_MAP: Record<string, TaskItemPriority> = {
  "0": "none",
  "1": "low",
  "3": "medium",
  "5": "high",
};

/** 简易 CSV 解析（支持引号与换行字段） */
export function parseCsvRows(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQ = false;
  const text = src.replace(/^\uFEFF/, "");
  while (i < text.length) {
    const c = text[i] ?? "";
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * 解析 ISO8601 duration（滴答 Reminder）。
 * - 负号 / 显式 `-`：相对 due 提前
 * - 正 duration 且含日期分量（如 P0DT9H0M0S）：当天本地时刻（相对 due 日）
 * - PT0S / -PT0S：截止时
 */
export function reminderDurationToAt(
  durationRaw: string,
  dueAt: string,
  timeZone = "Asia/Shanghai",
): string | null {
  const raw = durationRaw.trim();
  if (!raw) return null;
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  if (!/^P/i.test(body)) return null;

  const parsed = parseIsoDuration(body);
  if (!parsed) return null;

  const dueMs = Date.parse(dueAt);
  if (!Number.isFinite(dueMs)) return null;

  // 纯「当天时刻」：非负且只有时间分量、天为 0（滴答全天 09:00）
  const isTimeOfDay =
    !negative &&
    parsed.years === 0 &&
    parsed.months === 0 &&
    parsed.weeks === 0 &&
    parsed.days === 0 &&
    (parsed.hours !== 0 || parsed.minutes !== 0 || parsed.seconds !== 0);

  if (isTimeOfDay) {
    const due = new Date(dueAt);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(due);
    const y = parts.find((p) => p.type === "year")?.value;
    const mo = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !mo || !d) return null;
    const hh = String(parsed.hours).padStart(2, "0");
    const mi = String(parsed.minutes).padStart(2, "0");
    const ss = String(parsed.seconds).padStart(2, "0");
    // 构造 Asia/Shanghai 墙钟 → ISO
    const local = new Date(`${y}-${mo}-${d}T${hh}:${mi}:${ss}+08:00`);
    if (Number.isNaN(local.getTime())) return null;
    return formatCstIso(local);
  }

  const totalMs =
    ((((parsed.years * 365 + parsed.months * 30 + parsed.weeks * 7 + parsed.days) * 24 +
      parsed.hours) *
      60 +
      parsed.minutes) *
      60 +
      parsed.seconds) *
    1000;
  const atMs = negative ? dueMs - totalMs : dueMs + totalMs;
  return formatCstIso(new Date(atMs));
}

type IsoDuration = {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function parseIsoDuration(body: string): IsoDuration | null {
  const m =
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(
      body,
    );
  if (!m) return null;
  return {
    years: Number(m[1] ?? 0),
    months: Number(m[2] ?? 0),
    weeks: Number(m[3] ?? 0),
    days: Number(m[4] ?? 0),
    hours: Number(m[5] ?? 0),
    minutes: Number(m[6] ?? 0),
    seconds: Number(m[7] ?? 0),
  };
}

function folderOpId(folderName: string): string {
  return `dida:folder:${folderName}`;
}

function listOpId(folderName: string, listName: string): string {
  return `dida:list:${folderName}/${listName}`;
}

function taskOpId(taskId: string): string {
  return `dida:${taskId}`;
}

function normalizeIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  return formatCstIso(new Date(ms));
}

function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseReminders(
  remRaw: string,
  dueAt: string | null,
  warnings: string[],
): Array<{ at: string }> {
  if (!dueAt) {
    if (remRaw.trim()) warnings.push("无 due，丢弃提醒");
    return [];
  }
  const parts = remRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ats: string[] = [];
  for (const p of parts) {
    const at = reminderDurationToAt(p, dueAt);
    if (at) ats.push(at);
    else warnings.push(`无法解析提醒: ${p}`);
  }
  return [...new Set(ats)].toSorted((a, b) => Date.parse(a) - Date.parse(b)).map((at) => ({ at }));
}

function csvCell(row: string[], i: number): string {
  return i >= 0 ? (row[i] ?? "") : "";
}

export function parseDidaCsv(text: string): DidaCsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { ok: false, error: "空文件" };

  let version: string | null = null;
  for (const r of rows.slice(0, 8)) {
    const cell = r[0] ?? "";
    const vm = /^Version:\s*(.+)$/i.exec(cell);
    if (vm) version = vm[1]?.trim() ?? null;
  }

  const headerIdx = rows.findIndex((r) => (r[0] ?? "") === "Folder Name");
  if (headerIdx < 0) return { ok: false, error: "未找到 CSV 表头 Folder Name" };
  const header = rows[headerIdx] ?? [];
  const idx = (name: string): number => header.indexOf(name);
  const col = {
    folder: idx("Folder Name"),
    list: idx("List Name"),
    title: idx("Title"),
    tags: idx("Tags"),
    content: idx("Content"),
    start: idx("Start Date"),
    due: idx("Due Date"),
    reminder: idx("Reminder"),
    repeat: idx("Repeat"),
    priority: idx("Priority"),
    status: idx("Status"),
    order: idx("Order"),
    taskId: idx("taskId"),
    parentId: idx("parentId"),
  };
  if (col.list < 0 || col.title < 0 || col.taskId < 0) {
    return { ok: false, error: "表头缺少 List Name / Title / taskId" };
  }

  const listMap = new Map<string, DidaCsvMappedList>();
  const folderSet = new Set<string>();
  const tasks: DidaCsvMappedTask[] = [];
  const skipped_tasks: DidaCsvSkippedTask[] = [];

  for (const row of rows.slice(headerIdx + 1)) {
    if (row.length < 3) continue;
    const taskId = csvCell(row, col.taskId).trim();
    if (!taskId) continue;

    const statusRaw = csvCell(row, col.status).trim();
    const folderName = csvCell(row, col.folder).trim();
    const listName = csvCell(row, col.list).trim() || "未命名清单";
    const title = csvCell(row, col.title).trim() || "(无标题)";

    if (statusRaw === "-1") {
      skipped_tasks.push({
        client_op_id: taskOpId(taskId),
        title,
        list_name: listName,
        folder_name: folderName,
        reason: "已放弃（Status=-1）",
      });
      continue;
    }

    const warnings: string[] = [];

    if (folderName) {
      const fOp = folderOpId(folderName);
      if (!folderSet.has(fOp)) {
        folderSet.add(fOp);
        listMap.set(fOp, {
          client_op_id: fOp,
          name: folderName,
          is_folder: true,
          parent_folder_op_id: null,
        });
      }
    }

    const lOp = listOpId(folderName, listName);
    if (!listMap.has(lOp)) {
      listMap.set(lOp, {
        client_op_id: lOp,
        name: listName,
        is_folder: false,
        parent_folder_op_id: folderName ? folderOpId(folderName) : null,
      });
    }

    let dueAt = normalizeIso(csvCell(row, col.due));
    let startAt = normalizeIso(csvCell(row, col.start));
    if (startAt && !dueAt) {
      warnings.push("仅有 Start 无 Due，丢弃 start");
      startAt = null;
    }
    if (startAt && dueAt && Date.parse(startAt) > Date.parse(dueAt)) {
      warnings.push("start > due，交换");
      const tmp = startAt;
      startAt = dueAt;
      dueAt = tmp;
    }
    if (startAt && dueAt && startAt === dueAt) {
      startAt = null;
    }

    const remRaw = csvCell(row, col.reminder);
    const reminders = parseReminders(remRaw, dueAt, warnings);

    const repeatRaw = csvCell(row, col.repeat).trim();
    let recurrence: TaskRecurrenceInput | null = null;
    if (repeatRaw) {
      if (!dueAt) {
        warnings.push("无 due，丢弃重复规则");
      } else {
        const parsed = parseDidaRepeat(repeatRaw, dueAt);
        if (parsed.ok) recurrence = parsed.recurrence;
        else warnings.push(`重复规则未映射: ${parsed.reason}`);
      }
    }

    const parentRaw = csvCell(row, col.parentId).trim();
    const parent_task_op_id = parentRaw ? taskOpId(parentRaw) : null;
    if (parent_task_op_id && recurrence) {
      warnings.push("子任务不支持重复，已丢弃 recurrence");
      recurrence = null;
    }

    const status: "pending" | "completed" = statusRaw === "2" ? "completed" : "pending";
    if (status === "completed" && recurrence) {
      warnings.push("已完成任务不保留重复规则");
      recurrence = null;
    }

    const orderRaw = csvCell(row, col.order).trim();
    const parsedOrder = Number.parseInt(orderRaw, 10);
    // 滴答 Order 常超 PG int4；导入时钳到 int32，避免 list/reminder 扫描 ORDER BY 炸库
    const sort_order = Number.isFinite(parsedOrder) ? clampSortOrder(parsedOrder) : 0;
    tasks.push({
      client_op_id: taskOpId(taskId),
      title,
      content: csvCell(row, col.content),
      tags: parseTags(csvCell(row, col.tags)),
      list_client_op_id: lOp,
      parent_task_op_id,
      priority: PRIORITY_MAP[csvCell(row, col.priority).trim()] ?? "none",
      status,
      start_at: startAt,
      due_at: dueAt,
      reminders,
      recurrence,
      sort_order,
      warnings,
    });
  }

  // 父任务缺失或父也是子任务 → 升格
  const byOp = new Map(tasks.map((t) => [t.client_op_id, t]));
  for (const t of tasks) {
    if (!t.parent_task_op_id) continue;
    const parent = byOp.get(t.parent_task_op_id);
    if (!parent) {
      t.warnings.push("父任务未导入，升格为根");
      t.parent_task_op_id = null;
      continue;
    }
    if (parent.parent_task_op_id) {
      t.warnings.push("超过一层子任务，升格为根");
      t.parent_task_op_id = null;
    }
  }

  const lists = [...listMap.values()].toSorted((a, b) => {
    if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
    return a.client_op_id.localeCompare(b.client_op_id);
  });

  const warnings = tasks.flatMap((t) => {
    const shortId = t.client_op_id.replace(/^dida:/, "");
    return t.warnings.map((w) => `${shortId}: ${w}`);
  });

  return {
    ok: true,
    version,
    lists,
    tasks,
    skipped_tasks,
    skipped_abandoned: skipped_tasks.length,
    warnings,
  };
}

export type DidaPreviewBucket = "ok" | "warn" | "skipped";

export type DidaPreviewRow = {
  bucket: DidaPreviewBucket;
  client_op_id: string;
  title: string;
  list_label: string;
  status_label: string;
  note: string;
};

/** 预览三分桶：正常导入 / 带警告仍导入 / 跳过 */
export function buildDidaPreviewRows(parsed: Extract<DidaCsvParseResult, { ok: true }>): {
  ok: DidaPreviewRow[];
  warn: DidaPreviewRow[];
  skipped: DidaPreviewRow[];
} {
  const listNameByOp = new Map(parsed.lists.map((l) => [l.client_op_id, l.name]));
  const ok: DidaPreviewRow[] = [];
  const warn: DidaPreviewRow[] = [];
  for (const t of parsed.tasks) {
    const list_label = listNameByOp.get(t.list_client_op_id) ?? t.list_client_op_id;
    const status_label = t.status === "completed" ? "已完成" : "待办";
    const row: DidaPreviewRow = {
      bucket: t.warnings.length > 0 ? "warn" : "ok",
      client_op_id: t.client_op_id,
      title: t.title,
      list_label,
      status_label,
      note: t.warnings.join("；"),
    };
    if (row.bucket === "warn") warn.push(row);
    else ok.push(row);
  }
  const skipped: DidaPreviewRow[] = parsed.skipped_tasks.map((t) => ({
    bucket: "skipped" as const,
    client_op_id: t.client_op_id,
    title: t.title,
    list_label: t.folder_name ? `${t.folder_name} / ${t.list_name}` : t.list_name,
    status_label: "已放弃",
    note: t.reason,
  }));
  return { ok, warn, skipped };
}

export function planDidaImport(
  parsed: Extract<DidaCsvParseResult, { ok: true }>,
  existingByClientOpId: Map<string, number>,
  mode: DidaImportMode = "upsert",
): DidaImportPlanEntry[] {
  const plan: DidaImportPlanEntry[] = [];
  for (const list of parsed.lists) {
    const local = existingByClientOpId.get(list.client_op_id);
    if (local != null) {
      plan.push({
        kind: list.is_folder ? "folder" : "list",
        action: mode === "create_only" ? "skip" : "update",
        mapped: list,
        local_id: local,
        ...(mode === "create_only" ? { reason: "已存在" } : {}),
      });
    } else {
      plan.push({
        kind: list.is_folder ? "folder" : "list",
        action: "create",
        mapped: list,
      });
    }
  }
  for (const task of parsed.tasks) {
    const local = existingByClientOpId.get(task.client_op_id);
    if (local != null) {
      plan.push({
        kind: "task",
        action: mode === "create_only" ? "skip" : "update",
        mapped: task,
        local_id: local,
        ...(mode === "create_only" ? { reason: "已存在" } : {}),
      });
    } else {
      plan.push({ kind: "task", action: "create", mapped: task });
    }
  }
  return plan;
}

export function indexClientOpIds(
  rows: Array<{ id: number; client_op_id?: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.client_op_id) map.set(r.client_op_id, r.id);
  }
  return map;
}
