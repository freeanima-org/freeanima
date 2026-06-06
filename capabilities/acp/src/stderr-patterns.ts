/** 从 stderr 尾行识别常见错误模式 */

export type StderrDiagnosis = {
  pattern: string;
  hint: string;
};

const PATTERNS: Array<{ re: RegExp; pattern: string; hint: string }> = [
  {
    re: /auth|login|unauthorized|401|403/i,
    pattern: "authentication",
    hint: "Cursor 认证失败，请运行 agent login",
  },
  {
    re: /ENOMEM|out of memory|heap out of memory/i,
    pattern: "memory",
    hint: "内存不足，尝试减小任务范围或增加系统内存",
  },
  {
    re: /ENOENT|command not found|not found/i,
    pattern: "missing_binary",
    hint: "命令或依赖未找到，检查 command/args 配置",
  },
  {
    re: /EACCES|permission denied/i,
    pattern: "permission",
    hint: "权限不足，检查 cwd 与文件权限",
  },
  {
    re: /rate limit|429|too many requests/i,
    pattern: "rate_limit",
    hint: "API 速率限制，稍后重试",
  },
  {
    re: /network|ECONNREFUSED|ETIMEDOUT|fetch failed/i,
    pattern: "network",
    hint: "网络连接问题，检查代理与防火墙",
  },
];

export function diagnoseStderr(lines: string[]): StderrDiagnosis | null {
  const tail = lines.slice(-10).join(" ");
  if (!tail.trim()) return null;
  for (const { re, pattern, hint } of PATTERNS) {
    if (re.test(tail)) return { pattern, hint };
  }
  return null;
}
