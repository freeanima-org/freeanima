import type { ExtVaultListItem, FillPayload } from "../../runtime/messages.ts";
import { sendBg } from "../../runtime/messages.ts";
import { fillLogin, isLoginCredentialField } from "./dom-fill.ts";

const HOST_ID = "freeanima-vault-page-ui";

type PageUiDeps = {
  send: typeof sendBg;
  fill: typeof fillLogin;
  getPageUrl: () => string;
};

const defaultDeps: PageUiDeps = {
  send: sendBg,
  fill: fillLogin,
  getPageUrl: () => location.href,
};

let deps: PageUiDeps = defaultDeps;
let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let activeInput: HTMLInputElement | null = null;

/** 单测可注入 */
export function setPageUiDepsForTest(next: Partial<PageUiDeps> | null): void {
  deps = next ? { ...defaultDeps, ...next } : defaultDeps;
}

function ensureHost(): ShadowRoot {
  if (host && shadow && document.documentElement.contains(host)) return shadow;
  host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all:initial;position:absolute;left:0;top:0;z-index:2147483646;";
    document.documentElement.appendChild(host);
  }
  shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadow.querySelector("style")) {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .fa-wrap { position: fixed; z-index: 2147483646; font-family: system-ui, sans-serif; }
      .fa-actions {
        display: flex; gap: 4px; justify-content: flex-end; margin-bottom: 4px;
      }
      .fa-btn {
        border: 1px solid #c9cdd4; background: #fff; color: #1f2329;
        border-radius: 6px; padding: 2px 8px; font-size: 12px; line-height: 20px;
        cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.08);
      }
      .fa-btn:hover { background: #f5f6f7; }
      .fa-list {
        min-width: 220px; max-width: 320px; max-height: 240px; overflow: auto;
        background: #fff; border: 1px solid #c9cdd4; border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,.12); padding: 4px;
      }
      .fa-item {
        display: block; width: 100%; text-align: left; border: 0; background: transparent;
        border-radius: 6px; padding: 8px 10px; cursor: pointer; color: #1f2329;
      }
      .fa-item:hover, .fa-item:focus { background: #f0f3f8; outline: none; }
      .fa-title { font-size: 13px; font-weight: 600; }
      .fa-sub { font-size: 11px; color: #646a73; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .fa-empty { padding: 10px; font-size: 12px; color: #646a73; }
      .fa-badge { margin-left: 6px; font-size: 10px; color: #2b6cb0; background: #e8f1fb; border-radius: 4px; padding: 1px 4px; }
    `;
    shadow.appendChild(style);
  }
  return shadow;
}

function clearUi(): void {
  if (!shadow) return;
  for (const el of shadow.querySelectorAll(".fa-wrap")) el.remove();
}

function scheduleHide(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    clearUi();
    activeInput = null;
  }, 180);
}

function cancelHide(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function positionWrap(wrap: HTMLElement, input: HTMLInputElement): void {
  const rect = input.getBoundingClientRect();
  wrap.style.left = `${Math.max(8, rect.left)}px`;
  wrap.style.top = `${rect.bottom + 4}px`;
  wrap.style.width = `${Math.max(rect.width, 240)}px`;
}

async function copyPassword(itemId: number): Promise<void> {
  const fillRes = await deps.send({ type: "get_fill_payload", item_id: itemId });
  if (!fillRes.ok || !("fill" in fillRes) || !fillRes.fill.password) return;
  try {
    await navigator.clipboard.writeText(fillRes.fill.password);
  } catch {
    /* 页面策略可能禁止剪贴板 */
  }
}

async function applyFill(itemId: number): Promise<void> {
  const fillRes = await deps.send({ type: "get_fill_payload", item_id: itemId });
  if (!fillRes.ok || !("fill" in fillRes)) return;
  deps.fill(fillRes.fill as FillPayload);
  void deps.send({ type: "record_fill_used", item_id: itemId });
  clearUi();
}

function renderList(wrap: HTMLElement, items: ExtVaultListItem[]): void {
  const list = document.createElement("div");
  list.className = "fa-list";
  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("mouseenter", cancelHide);
  list.addEventListener("mouseleave", scheduleHide);

  const logins = items.filter((i) => i.item_type === "login");
  if (logins.length === 0) {
    const empty = document.createElement("div");
    empty.className = "fa-empty";
    empty.textContent = "无匹配登录项";
    list.appendChild(empty);
    wrap.appendChild(list);
    return;
  }

  for (const item of logins.slice(0, 8)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fa-item";
    btn.innerHTML = `<div class="fa-title">${escapeHtml(item.title)}${
      item.matched ? '<span class="fa-badge">匹配</span>' : ""
    }</div><div class="fa-sub">${escapeHtml(item.username ?? item.url ?? "")}</div>`;
    btn.addEventListener("click", () => {
      void applyFill(item.id);
    });
    list.appendChild(btn);
  }
  wrap.appendChild(list);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function showForInput(input: HTMLInputElement): Promise<void> {
  cancelHide();
  activeInput = input;
  const status = await deps.send({ type: "get_status" });
  if (!status.ok || !("unlocked" in status) || !status.unlocked) {
    clearUi();
    return;
  }

  const listRes = await deps.send({ type: "list_for_tab", tab_url: deps.getPageUrl() });
  if (!listRes.ok || !("items" in listRes)) {
    clearUi();
    return;
  }
  const items = listRes.items as ExtVaultListItem[];
  const preferred =
    items.find((i) => i.matched && i.item_type === "login") ??
    items.find((i) => i.item_type === "login") ??
    null;

  const root = ensureHost();
  clearUi();
  const wrap = document.createElement("div");
  wrap.className = "fa-wrap";
  positionWrap(wrap, input);

  const actions = document.createElement("div");
  actions.className = "fa-actions";
  actions.addEventListener("mousedown", (e) => e.preventDefault());
  actions.addEventListener("mouseenter", cancelHide);
  actions.addEventListener("mouseleave", scheduleHide);

  const fillBtn = document.createElement("button");
  fillBtn.type = "button";
  fillBtn.className = "fa-btn";
  fillBtn.title = "自动填充";
  fillBtn.textContent = "填充";
  fillBtn.disabled = !preferred;
  fillBtn.addEventListener("click", () => {
    if (preferred) void applyFill(preferred.id);
  });

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "fa-btn";
  copyBtn.title = "复制密码";
  copyBtn.textContent = "复制密码";
  copyBtn.disabled = !preferred;
  copyBtn.addEventListener("click", () => {
    if (preferred) void copyPassword(preferred.id);
  });

  actions.append(fillBtn, copyBtn);
  wrap.appendChild(actions);
  renderList(wrap, items);
  root.appendChild(wrap);
}

function onFocusIn(ev: FocusEvent): void {
  const t = ev.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (!isLoginCredentialField(t)) return;
  void showForInput(t);
}

function onFocusOut(): void {
  scheduleHide();
}

export function attachPageAutofillUi(): void {
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener(
    "scroll",
    () => {
      const wrap = shadow?.querySelector(".fa-wrap") as HTMLElement | null;
      if (activeInput && wrap) positionWrap(wrap, activeInput);
    },
    true,
  );
}
