export function mcpStatusLabel(status: string): string {
  if (status === "connected") return "已连接";
  if (status === "connecting") return "连接中";
  if (status === "disabled") return "已禁用";
  if (status === "error") return "错误";
  return "未启动";
}

export function dependencyStatusLabel(status: string): string {
  if (status === "connected") return "已连接";
  if (status === "error") return "异常";
  return "未配置";
}

export function memoryTypeLabel(type: string): string {
  if (type === "semantic") return "语义记忆";
  if (type === "conversation") return "对话消息";
  if (type === "limbic") return "感性记忆";
  if (type === "autobiographical") return "自传体";
  return type;
}
