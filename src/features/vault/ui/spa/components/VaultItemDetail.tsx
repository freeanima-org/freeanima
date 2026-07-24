import { useEffect, useState } from "react";
import { Button } from "@freeanima/frontend/ui-kit";
import { copyText } from "@freeanima/frontend/ui-kit/lib/copy-text.ts";
import { generateTotpCode } from "@freeanima/shared/vault-crypto";
import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";

export type VaultDetailSecrets = {
  password?: string;
  notes?: string;
  totp?: string;
  custom_fields?: Array<{ name: string; value: string }>;
};

function SecretFieldRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const display = secret && !revealed ? "••••••••" : value;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex shrink-0 gap-1">
          {secret ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? "隐藏" : "显示"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              void copyText(value).then((ok) => {
                if (!ok) return;
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm break-all whitespace-pre-wrap">{display}</p>
    </div>
  );
}

function TotpPanel({ secret }: { secret: string }) {
  const [tick, setTick] = useState(() => Date.now());
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const result = generateTotpCode(secret, tick);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!result) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        TOTP 密钥无效，无法生成验证码
      </div>
    );
  }

  const progress = result.periodRemaining / result.period;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">验证码 (TOTP)</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => {
            void copyText(result.code).then((ok) => {
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
      <div className="flex items-end gap-4">
        <p className="font-mono text-3xl font-semibold tracking-[0.2em] tabular-nums">
          {result.code.slice(0, 3)} {result.code.slice(3)}
        </p>
        <div className="mb-1 flex-1 space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">{result.periodRemaining}s</p>
        </div>
      </div>
      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setShowSecret((v) => !v)}
        >
          {showSecret ? "隐藏密钥" : "显示密钥"}
        </Button>
        {showSecret ? (
          <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{secret}</p>
        ) : null}
      </div>
    </div>
  );
}

export function VaultItemDetail({
  item,
  secrets,
  secretsLoading,
}: {
  item: VaultItemMetaRowPayload;
  secrets: VaultDetailSecrets | null;
  secretsLoading: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{item.title}</h2>
        {item.url ? (
          <a
            href={item.url}
            className="text-sm text-primary break-all hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {item.url}
          </a>
        ) : null}
      </div>

      {item.username ? <SecretFieldRow label="用户名" value={item.username} /> : null}

      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {secretsLoading ? (
        <p className="text-sm text-muted-foreground">正在加载隐私字段…</p>
      ) : secrets ? (
        <div className="space-y-3">
          {secrets.password ? (
            <SecretFieldRow label="密码" value={secrets.password} secret />
          ) : null}
          {secrets.totp ? <TotpPanel secret={secrets.totp} /> : null}
          {secrets.notes ? <SecretFieldRow label="备注" value={secrets.notes} /> : null}
          {(secrets.custom_fields ?? []).map((field) =>
            field.name ? (
              <SecretFieldRow key={field.name} label={field.name} value={field.value} secret />
            ) : null,
          )}
          {!secrets.password &&
          !secrets.totp &&
          !secrets.notes &&
          !secrets.custom_fields?.length ? (
            <p className="text-sm text-muted-foreground">此条目没有隐私字段</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">无法加载隐私字段</p>
      )}
    </div>
  );
}
