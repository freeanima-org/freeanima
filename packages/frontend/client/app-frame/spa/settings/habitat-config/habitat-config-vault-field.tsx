import type { ReactNode } from "react";
import { getCachedResolvedWorldContext } from "@freeanima/client/portal-sdk/world-context.ts";
import { VaultRefField } from "@freeanima/features/vault/ui/spa/components/VaultRefField.tsx";

/**
 * 密钥字段：可手写明文 / env()，或从 Agent Vault 选择 vault() 引用。
 * Habitat 配置里的 vault() 在运行时由默认聊天 Anima 的私有 world 解析（与 vault-io 一致）。
 */
export function hubConfigVaultField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { type?: "text" | "password"; placeholder?: string; hint?: string },
): ReactNode {
  const subjectId = getCachedResolvedWorldContext()?.default_chat_agent_subject_id;
  if (subjectId == null || subjectId <= 0) {
    return (
      <p className="text-sm text-muted-foreground">{"无法选择 Vault：默认聊天 Anima 未就绪"}</p>
    );
  }
  return (
    <VaultRefField
      label={label}
      value={value}
      onChange={onChange}
      subjectId={subjectId}
      type={opts?.type ?? "text"}
      placeholder={opts?.placeholder ?? "未设置"}
      hint={
        opts?.hint ??
        '明文、vault("id","field") 或 env("KEY")；可点「从 Vault 选择」写入 Agent 库引用'
      }
    />
  );
}
