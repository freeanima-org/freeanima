import type { ReactNode } from "react";
import { VaultRefField } from "@freeanima/features/vault/ui/spa/components/VaultRefField.tsx";

/** 密钥字段：可手写明文 / env()，或从 Agent Vault 选择 vault() 引用 */
export function hubConfigVaultField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { type?: "text" | "password"; placeholder?: string; hint?: string },
): ReactNode {
  return (
    <VaultRefField
      label={label}
      value={value}
      onChange={onChange}
      type={opts?.type ?? "password"}
      {...(opts?.placeholder !== undefined ? { placeholder: opts.placeholder } : {})}
      hint={
        opts?.hint ??
        '明文、vault("id","field") 或 env("KEY")；可点「从 Vault 选择」写入 Agent 库引用'
      }
    />
  );
}
