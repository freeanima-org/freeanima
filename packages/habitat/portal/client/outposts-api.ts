import { CODING_APP_ID } from "@freeanima/shared/coding/constants.ts";
import { asRecord } from "@freeanima/shared/util";

export type CodingOutpostInstance = {
  app_id: string;
  instance_id: string;
  tool_count: number;
  tools: string[];
};

async function habitatRestGet(habitatUrl: string, token: string, path: string): Promise<unknown> {
  const base = habitatUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as unknown;
}

export async function listCodingOutposts(opts: {
  habitatUrl: string;
  token: string;
}): Promise<CodingOutpostInstance[]> {
  const raw = await habitatRestGet(opts.habitatUrl, opts.token, "/rpc/v1/outposts/status");
  const record = asRecord(raw);
  const instances = Array.isArray(record?.instances) ? record.instances : [];
  const out: CodingOutpostInstance[] = [];
  for (const row of instances) {
    const r = asRecord(row);
    const app_id = typeof r?.app_id === "string" ? r.app_id : "";
    if (app_id !== CODING_APP_ID) continue;
    const instance_id = typeof r?.instance_id === "string" ? r.instance_id.trim() : "";
    if (!instance_id) continue;
    const tools = Array.isArray(r?.tools)
      ? r.tools.filter((t): t is string => typeof t === "string")
      : [];
    out.push({
      app_id,
      instance_id,
      tool_count: typeof r?.tool_count === "number" ? r.tool_count : tools.length,
      tools,
    });
  }
  return out;
}
