import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api.ts";

type CredentialMeta = {
  path: string;
  category: string;
  name: string;
  label: string;
  yaml: boolean;
  fields: string[];
  tags: string[];
  desc: string;
};

type CredentialsLoaderData = {
  credentials: CredentialMeta[];
};

const EMPTY_LOADER_DATA: CredentialsLoaderData = { credentials: [] };

export const Route = createFileRoute("/chamber/credentials")({
  loader: () =>
    api.credentials.list.query().catch(() => EMPTY_LOADER_DATA) as Promise<CredentialsLoaderData>,
  component: CredentialsPage,
});

function CredentialCard({ cred }: { cred: CredentialMeta }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-mono text-sm font-bold">{cred.path}</h3>
          <div className="flex gap-1 flex-wrap">
            {cred.yaml ? <span className="badge badge-info badge-xs">YAML</span> : null}
            {cred.tags.map((tag) => (
              <span key={tag} className="badge badge-ghost badge-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
        {cred.desc ? <p className="text-xs text-base-content/60 mt-1">{cred.desc}</p> : null}
        {cred.fields.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {cred.fields.map((field) => (
              <code key={field} className="text-xs bg-base-300 px-1.5 py-0.5 rounded">
                {field}
              </code>
            ))}
          </div>
        ) : (
          <p className="text-xs text-base-content/40 mt-1">无结构化字段（纯文本凭证）</p>
        )}
      </div>
    </div>
  );
}

function CredentialsPage() {
  const data = Route.useLoaderData();
  const credentials = data.credentials ?? [];

  // 按 category 分组
  const byCategory = new Map<string, CredentialMeta[]>();
  for (const cred of credentials) {
    const cat = cred.category || "(未分类)";
    const list = byCategory.get(cat);
    if (list) list.push(cred);
    else byCategory.set(cat, [cred]);
  }

  const categories = [...byCategory.entries()].toSorted(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">🔐 凭证</h2>
        <p className="text-sm text-base-content/60 mt-1">
          已存储的凭证列表（仅元数据，不含密钥明文）。
          {credentials.length > 0 ? ` 共 ${credentials.length} 条。` : null}
        </p>
      </div>

      {credentials.length === 0 ? (
        <div className="alert alert-info text-sm">暂无凭证。</div>
      ) : (
        <div className="space-y-6">
          {categories.map(([category, creds]) => (
            <div key={category}>
              <h3 className="text-sm font-bold text-base-content/50 mb-2 uppercase tracking-wide">
                📁 {category}
              </h3>
              <div className="space-y-2">
                {creds.map((cred) => (
                  <CredentialCard key={cred.path} cred={cred} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
