import { ensureMobileShellForChat } from "./mobile-shell.ts";

async function main(): Promise<void> {
  await ensureMobileShellForChat();
  const entry = document.documentElement.dataset.chatEntry;
  if (!entry) {
    throw new Error("缺少 chat 入口脚本");
  }
  await import(/* @vite-ignore */ entry);
}

void main().catch((err) => {
  if (String(err).includes("redirect settings")) return;
  console.error("[bridge-init]", err);
  document.body.innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;color:#f88">壳层初始化失败</div>';
});
