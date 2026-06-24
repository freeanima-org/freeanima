import { installMobileShellFromPrefs } from "./mobile-shell.ts";
import { CHAT_PAGE, SETTINGS_PAGE } from "./paths.ts";

async function bootstrap(): Promise<void> {
  const shell = await installMobileShellFromPrefs();
  if (shell) {
    window.location.replace(CHAT_PAGE);
    return;
  }
  window.location.replace(SETTINGS_PAGE);
}

void bootstrap().catch((err) => {
  console.error("[bootstrap]", err);
  document.body.innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;color:#f88">启动失败，请重装 APP</div>';
});
