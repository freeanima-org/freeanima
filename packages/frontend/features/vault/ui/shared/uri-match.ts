import type { VaultUriMatch } from "@freeanima/shared/rpc-contract";

export const VAULT_URI_MATCH_OPTIONS: Array<{ value: VaultUriMatch; label: string }> = [
  { value: "domain", label: "域名" },
  { value: "host", label: "主机" },
  { value: "starts_with", label: "前缀" },
  { value: "exact", label: "精确" },
  { value: "regex", label: "正则" },
  { value: "never", label: "从不" },
];

export const VAULT_ITEM_TYPE_OPTIONS = [
  { value: "login", label: "登录" },
  { value: "secure_note", label: "安全笔记" },
  { value: "card", label: "卡片" },
  { value: "identity", label: "身份" },
  { value: "custom", label: "自定义" },
] as const;
