import { ensureMobileShellForChat } from "./mobile-shell.ts";

/** 卧室 WebUI bundled 页与 chat 共用同一 shell 注入逻辑 */
export async function ensureMobileShellForChamber(): Promise<void> {
  await ensureMobileShellForChat();
}

async function main(): Promise<void> {
  await ensureMobileShellForChamber();
  const entry = document.documentElement.dataset.webuiEntry;
  if (!entry) {
    throw new Error("缺少 webui 入口脚本");
  }
  await import(/* @vite-ignore */ entry);
}

void main().catch((err) => {
  if (String(err).includes("redirect settings")) return;
  console.error("[bridge-init-chamber]", err);
  document.body.innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;color:#f88">卧室壳层初始化失败</div>';
});
