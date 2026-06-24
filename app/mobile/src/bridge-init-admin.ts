import { ensureMobileShellForChat } from "./mobile-shell.ts";

/** 管理台 Admin bundled 页与 chat 共用同一 shell 注入逻辑 */
export async function ensureMobileShellForAdmin(): Promise<void> {
  await ensureMobileShellForChat();
}

async function main(): Promise<void> {
  await ensureMobileShellForAdmin();
  const entry = document.documentElement.dataset.adminEntry;
  if (!entry) {
    throw new Error("缺少 admin 入口脚本");
  }
  await import(/* @vite-ignore */ entry);
}

void main().catch((err) => {
  if (String(err).includes("redirect settings")) return;
  console.error("[bridge-init-admin]", err);
  document.body.innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;color:#f88">管理台壳层初始化失败</div>';
});
