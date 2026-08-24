import { resolveContactByPublicId } from "@freeanima/features/contact/domain/index.ts";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/resolved-world-context.ts";
import { listEntities } from "@freeanima/habitat/core/db/pg/entity";
import { agentConfigBodySchema } from "@freeanima/habitat/core/db/schema/entity";
import { getTrustedSatellite } from "@freeanima/habitat/core/db/pg/federation";
import { habitatCtx } from "@freeanima/features/habitat/habitat/habitat-api/handlers/runtime.ts";

/** 解析后的发言人身份片段（组装花名册 / 投影前）。 */
export type SpeakerLabelParts = {
  public_id: string;
  /** Contact.title 或本机 subject.title；无则空，由调用方回退 public_id */
  base_name: string;
  contact_id?: number;
  habitat_instance_id?: string;
  /** 授信备注或其它人类可读实例名 */
  habitat_label?: string;
  /** 外站 anima / 非本机实例 */
  remote: boolean;
};

function subjectPublicId(body: unknown): string | null {
  const parsed = agentConfigBodySchema.safeParse(body);
  if (!parsed.success) return null;
  const id = parsed.data.public_id?.trim();
  return id || null;
}

export function shortPublicId(publicId: string): string {
  const id = publicId.trim();
  if (id.length <= 10) return id;
  return id.slice(-6);
}

export function shortHabitatInstanceId(habitatInstanceId: string): string {
  const id = habitatInstanceId.trim();
  if (!id) return "";
  const dash = id.lastIndexOf("_");
  const tail = dash >= 0 ? id.slice(dash + 1) : id;
  if (tail.length <= 8) return tail || id;
  return tail.slice(-8);
}

/**
 * 同名或跨实例时追加消歧：`名称 · 实例备注|短实例id|短 public_id`。
 * 主键仍是 public_id；此处只算可读 display。
 */
export function disambiguateSpeakerLabels(parts: SpeakerLabelParts[]): Map<string, string> {
  const titleCounts = new Map<string, number>();
  for (const p of parts) {
    const key = p.base_name.trim() || p.public_id;
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const p of parts) {
    const base = p.base_name.trim() || p.public_id;
    const collision = (titleCounts.get(base) ?? 0) > 1;
    const needsDisambig = collision || p.remote;
    if (!needsDisambig) {
      out.set(p.public_id, base);
      continue;
    }
    const hint =
      p.habitat_label?.trim() ||
      (p.habitat_instance_id ? shortHabitatInstanceId(p.habitat_instance_id) : "") ||
      shortPublicId(p.public_id);
    out.set(p.public_id, hint ? `${base} · ${hint}` : base);
  }
  return out;
}

function localHabitatInstanceId(): string | null {
  try {
    return habitatCtx().engine.config.data.identity?.habitat_instance_id ?? null;
  } catch {
    return null;
  }
}

async function subjectTitleForPublicId(publicId: string): Promise<string | undefined> {
  const agents = await listEntities({ type: "agent", limit: 200 });
  for (const row of agents) {
    if (subjectPublicId(row.body) === publicId) {
      const t = row.title.trim();
      if (t) return t;
    }
  }
  const users = await listEntities({ type: "user", limit: 5 });
  for (const row of users) {
    if (subjectPublicId(row.body) === publicId) {
      const t = row.title.trim();
      if (t) return t;
    }
  }
  return undefined;
}

async function isLocalSubjectPublicId(publicId: string): Promise<boolean> {
  const agents = await listEntities({ type: "agent", limit: 200 });
  for (const row of agents) {
    if (subjectPublicId(row.body) === publicId) return true;
  }
  const users = await listEntities({ type: "user", limit: 5 });
  for (const row of users) {
    if (subjectPublicId(row.body) === publicId) return true;
  }
  return false;
}

/** 解析单个 public_id 的名称与实例线索（不含集合内消歧）。 */
export async function resolveSpeakerLabelParts(publicId: string): Promise<SpeakerLabelParts> {
  const id = publicId.trim();
  const localInst = localHabitatInstanceId();
  let base_name = "";
  let contact_id: number | undefined;
  let habitat_instance_id: string | undefined;
  let habitat_label: string | undefined;
  let remote = false;

  try {
    const commonsId = getResolvedWorldContext().commons_world_id;
    const contact = await resolveContactByPublicId(commonsId, id);
    if (contact) {
      contact_id = contact.id;
      if (contact.title.trim()) base_name = contact.title.trim();
      const anima = (contact.animas ?? []).find((a) => a.public_id === id);
      if (anima?.kind === "external") {
        remote = true;
        habitat_instance_id = anima.habitat_instance_id;
        try {
          const trusted = await getTrustedSatellite(anima.habitat_instance_id);
          if (trusted?.label?.trim()) habitat_label = trusted.label.trim();
        } catch {
          /* 授信表不可用时忽略 */
        }
      } else if (anima?.kind === "local") {
        habitat_instance_id = localInst ?? undefined;
      }
    }
  } catch {
    /* Contact 解析失败则回退 subject */
  }

  if (!base_name) {
    base_name = (await subjectTitleForPublicId(id)) ?? "";
  }

  if (!remote) {
    const local = await isLocalSubjectPublicId(id);
    if (!local && habitat_instance_id && localInst && habitat_instance_id !== localInst) {
      remote = true;
    }
  }

  return {
    public_id: id,
    base_name,
    ...(contact_id != null ? { contact_id } : {}),
    ...(habitat_instance_id ? { habitat_instance_id } : {}),
    ...(habitat_label ? { habitat_label } : {}),
    remote,
  };
}

/** 一组 public_id → 消歧后的展示名（Room 花名册 / 投影 / UI）。 */
export async function resolveDisambiguatedSpeakerLabels(
  publicIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(publicIds.map((x) => x.trim()).filter(Boolean))];
  const parts = await Promise.all(unique.map((id) => resolveSpeakerLabelParts(id)));
  return disambiguateSpeakerLabels(parts);
}

/** 一组 public_id → 消歧名 + 原始 parts（花名册 attrs 用）。 */
export async function resolveSpeakerLabelBundle(publicIds: string[]): Promise<{
  labels: Map<string, string>;
  partsById: Map<string, SpeakerLabelParts>;
}> {
  const unique = [...new Set(publicIds.map((x) => x.trim()).filter(Boolean))];
  const parts = await Promise.all(unique.map((id) => resolveSpeakerLabelParts(id)));
  const partsById = new Map(parts.map((p) => [p.public_id, p]));
  return { labels: disambiguateSpeakerLabels(parts), partsById };
}
