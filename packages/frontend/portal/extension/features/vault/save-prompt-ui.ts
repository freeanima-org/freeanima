export type SaveLoginPromptMode = "save" | "update";

export type SaveLoginPromptInput = {
  mode: SaveLoginPromptMode;
  username: string;
  url: string;
};

export type SaveLoginPromptAction = "save" | "cancel" | "mute";

const HOST_ID = "freeanima-vault-save-prompt";

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let activePrompt: Promise<SaveLoginPromptAction> | null = null;

function ensureHost(): ShadowRoot {
  if (host && shadow && document.documentElement.contains(host)) return shadow;
  host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.appendChild(host);
  }
  shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadow.querySelector("style")) {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .fa-overlay {
        position: fixed; inset: 0; pointer-events: auto;
        display: flex; align-items: flex-end; justify-content: center;
        padding: 16px; box-sizing: border-box;
        background: rgba(0, 0, 0, 0.08);
      }
      .fa-card {
        width: min(420px, 100%); background: #fff; border: 1px solid #c9cdd4;
        border-radius: 10px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
        padding: 16px; font-family: system-ui, sans-serif; color: #1f2329;
      }
      .fa-title { font-size: 14px; font-weight: 600; line-height: 1.4; }
      .fa-meta { margin-top: 8px; font-size: 12px; color: #646a73; line-height: 1.5; word-break: break-all; }
      .fa-actions {
        display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;
        margin-top: 16px;
      }
      .fa-btn {
        border: 1px solid #c9cdd4; background: #fff; color: #1f2329;
        border-radius: 6px; padding: 6px 12px; font-size: 12px; line-height: 20px;
        cursor: pointer;
      }
      .fa-btn:hover { background: #f5f6f7; }
      .fa-btn-primary {
        background: #2b6cb0; border-color: #2b6cb0; color: #fff;
      }
      .fa-btn-primary:hover { background: #245a94; }
      .fa-btn-muted { color: #646a73; }
    `;
    shadow.appendChild(style);
  }
  return shadow;
}

function clearPrompt(): void {
  if (!shadow) return;
  for (const el of shadow.querySelectorAll(".fa-overlay")) el.remove();
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function resolvePrompt(
  action: SaveLoginPromptAction,
  resolve: (value: SaveLoginPromptAction) => void,
): void {
  clearPrompt();
  activePrompt = null;
  resolve(action);
}

export function showSaveLoginPrompt(input: SaveLoginPromptInput): Promise<SaveLoginPromptAction> {
  if (activePrompt) return activePrompt;

  activePrompt = new Promise((resolve) => {
    const root = ensureHost();
    clearPrompt();

    const overlay = document.createElement("div");
    overlay.className = "fa-overlay";

    const card = document.createElement("div");
    card.className = "fa-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");

    const title = document.createElement("div");
    title.className = "fa-title";
    title.textContent =
      input.mode === "update"
        ? "检测到密码已变更，是否更新 FreeAnima 保险库？"
        : "将登录凭据保存到 FreeAnima 保险库？";

    const meta = document.createElement("div");
    meta.className = "fa-meta";
    meta.innerHTML = `${escapeHtml(input.username || "(无用户名)")}<br>${escapeHtml(input.url)}`;

    const actions = document.createElement("div");
    actions.className = "fa-actions";

    const muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "fa-btn fa-btn-muted";
    muteBtn.textContent = "本域名不再提示";
    muteBtn.addEventListener("click", () => resolvePrompt("mute", resolve));

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "fa-btn";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => resolvePrompt("cancel", resolve));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "fa-btn fa-btn-primary";
    saveBtn.textContent = input.mode === "update" ? "更新" : "保存";
    saveBtn.addEventListener("click", () => resolvePrompt("save", resolve));

    actions.append(muteBtn, cancelBtn, saveBtn);
    card.append(title, meta, actions);
    overlay.appendChild(card);
    root.appendChild(overlay);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        document.removeEventListener("keydown", onKeyDown, true);
        resolvePrompt("cancel", resolve);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
  });

  return activePrompt;
}

/** 单测清理 */
export function resetSaveLoginPromptUiForTest(): void {
  clearPrompt();
  activePrompt = null;
}
