import type {
  ObjectiveCompletionPayload,
  ObjectiveLinkPayload,
  ObjectiveRowPayload,
  ObjectiveStatusPayload,
} from "@freeanima/shared/rpc-contract/frames/objective.ts";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

export type ObjectiveRow = ObjectiveRowPayload;
export type ObjectiveCompletion = ObjectiveCompletionPayload;
export type ObjectiveLink = ObjectiveLinkPayload;
export type ObjectiveStatus = ObjectiveStatusPayload;

function habitat() {
  return getTypedHabitatClient();
}

export async function fetchObjectives(
  subjectId: number,
  opts?: { include_inactive?: boolean; parent_id?: number | null },
): Promise<ObjectiveRow[]> {
  const scope = resolveHabitatCacheScope();
  const inactive = opts?.include_inactive ? "all" : "active";
  const parentKey =
    opts?.parent_id === null ? "root" : opts?.parent_id != null ? String(opts.parent_id) : "tree";
  return withOfflineCache({
    scope,
    namespace: "objective",
    id: `list:${subjectId}:${inactive}:${parentKey}`,
    fetch: async () => {
      const data = await habitat().call("objective.list", {
        subject_id: subjectId,
        ...(opts?.include_inactive ? { include_inactive: true } : {}),
        ...(opts?.parent_id !== undefined ? { parent_id: opts.parent_id } : {}),
      });
      return data.items;
    },
    offlineError: "objective.list unavailable offline",
  });
}

export async function createObjectiveRemote(
  subjectId: number,
  input: {
    title: string;
    content?: string;
    parent_id?: number | null;
    status?: ObjectiveStatus;
    start_at?: string | null;
    end_at?: string | null;
    completion?: ObjectiveCompletion;
  },
): Promise<ObjectiveRow> {
  const data = await habitat().call("objective.create", {
    subject_id: subjectId,
    ...input,
  });
  await invalidatePortalReads(["objective"]);
  return data.item;
}

export async function patchObjectiveRemote(
  subjectId: number,
  id: number,
  patch: {
    title?: string;
    content?: string;
    parent_id?: number | null;
    status?: ObjectiveStatus;
    start_at?: string | null;
    end_at?: string | null;
    completion?: ObjectiveCompletion;
    links?: ObjectiveLink[];
  },
): Promise<ObjectiveRow> {
  const data = await habitat().call("objective.patch", {
    subject_id: subjectId,
    id,
    ...patch,
  });
  await invalidatePortalReads(["objective"]);
  return data.item;
}

export async function deleteObjectiveRemote(subjectId: number, id: number): Promise<void> {
  await habitat().call("objective.delete", { subject_id: subjectId, id });
  await invalidatePortalReads(["objective"]);
}

export async function linkObjectiveRemote(
  subjectId: number,
  id: number,
  link: ObjectiveLink,
): Promise<ObjectiveRow> {
  const data = await habitat().call("objective.link", {
    subject_id: subjectId,
    id,
    link,
  });
  await invalidatePortalReads(["objective"]);
  return data.item;
}

export async function unlinkObjectiveRemote(
  subjectId: number,
  id: number,
  link: ObjectiveLink,
): Promise<ObjectiveRow> {
  const data = await habitat().call("objective.unlink", {
    subject_id: subjectId,
    id,
    link,
  });
  await invalidatePortalReads(["objective"]);
  return data.item;
}

export const OBJECTIVE_STATUS_LABEL: Record<ObjectiveStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
  on_hold: "暂停",
};

export const OBJECTIVE_LINK_KIND_LABEL: Record<ObjectiveLink["kind"], string> = {
  project: "项目",
  task_item: "任务",
  task_list: "清单",
  calendar_event: "日程",
};

export function formatProgress(row: ObjectiveRow): string | null {
  const p = row.resolved_progress;
  if (!p) return null;
  if (p.source === "children_completed" && p.ratio != null) {
    return `${p.current} / ${p.target} 个（${Math.round(p.ratio * 100)}%）`;
  }
  return `${p.current} / ${p.target} ${p.unit}`;
}

export function linkHref(link: ObjectiveLink): string {
  switch (link.kind) {
    case "project":
      return `/projects?project=${link.id}`;
    case "task_item":
      return `/tasks?item=${link.id}`;
    case "task_list":
      return `/tasks?list=${link.id}`;
    case "calendar_event":
      return `/calendar?event=${link.id}`;
    default: {
      const _exhaustive: never = link.kind;
      return _exhaustive;
    }
  }
}
