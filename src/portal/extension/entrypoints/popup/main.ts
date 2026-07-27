import {
  sendBg,
  type ExtVaultEditorItem,
  type ExtVaultListItem,
  type VaultItemType,
  type VaultUriMatch,
} from "../../runtime/messages.ts";
import { loadSettings, saveSettings } from "../../runtime/settings.ts";

type TabId = "vault" | "generator" | "options";
type Screen = { kind: "main" } | { kind: "editor"; itemId: number | null };

const URI_MATCHES: Array<{ value: VaultUriMatch; label: string }> = [
  { value: "domain", label: "域名" },
  { value: "host", label: "主机" },
  { value: "starts_with", label: "前缀" },
  { value: "exact", label: "精确" },
  { value: "regex", label: "正则" },
  { value: "never", label: "从不" },
];

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

let activeTab: TabId = "vault";
let screen: Screen = { kind: "main" };
let allItems: ExtVaultListItem[] = [];
let searchQuery = "";
let typeFilter = "all";
let openMenuId: number | null = null;
let listError = "";
let editorError = "";
let editorDraft: ExtVaultEditorItem | null = null;
let genPassword = "";
let genLength = 16;
let genUpper = true;
let genLower = true;
let genDigits = true;
let genSymbols = false;

async function activeTabUrl(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? "";
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function filteredItems(): ExtVaultListItem[] {
  const q = searchQuery.trim().toLowerCase();
  return allItems.filter((item) => {
    if (typeFilter !== "all" && item.item_type !== typeFilter) return false;
    if (!q) return true;
    const hay = [
      item.title,
      item.username ?? "",
      item.url ?? "",
      item.content,
      ...(item.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

async function fillItem(id: number): Promise<void> {
  const fillRes = await sendBg({ type: "get_fill_payload", item_id: id });
  if (!fillRes.ok || !("fill" in fillRes)) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, { type: "fill_login", fill: fillRes.fill });
  window.close();
}

async function copyField(id: number, field: "username" | "password" | "totp"): Promise<void> {
  const fillRes = await sendBg({ type: "get_fill_payload", item_id: id });
  if (!fillRes.ok || !("fill" in fillRes)) return;
  const value =
    field === "username"
      ? (fillRes.fill.username ?? "")
      : field === "password"
        ? (fillRes.fill.password ?? "")
        : (fillRes.fill.totp ?? "");
  if (value) await navigator.clipboard.writeText(value);
  openMenuId = null;
  void renderShell();
}

async function refreshVaultList(): Promise<"ok" | "vault_locked" | "error"> {
  const tabUrl = await activeTabUrl();
  const listRes = await sendBg({ type: "list_for_tab", tab_url: tabUrl });
  if (!listRes.ok) {
    if (listRes.error === "vault_locked") {
      listError = "";
      allItems = [];
      return "vault_locked";
    }
    listError = listRes.error;
    allItems = [];
    return "error";
  }
  listError = "";
  allItems = "items" in listRes ? listRes.items : [];
  return "ok";
}

async function regeneratePassword(): Promise<void> {
  const res = await sendBg({
    type: "generate_password",
    length: genLength,
    upper: genUpper,
    lower: genLower,
    digits: genDigits,
    symbols: genSymbols,
  });
  if (res.ok && "password" in res) genPassword = res.password;
}

function emptyEditorDraft(tabUrl: string): ExtVaultEditorItem {
  const uri = tabUrl.startsWith("http") ? tabUrl : "";
  let title = "";
  if (uri) {
    try {
      title = new URL(uri).hostname;
    } catch {
      title = "";
    }
  }
  return {
    title,
    item_type: "login",
    username: "",
    url: uri,
    uris: uri ? [{ uri, match: "domain" }] : [{ uri: "", match: "domain" }],
    tags: [],
    content: "",
    password: "",
    notes: "",
    totp: "",
  };
}

function matchSelect(selected: VaultUriMatch): string {
  return URI_MATCHES.map(
    (m) =>
      `<option value="${m.value}" ${selected === m.value ? "selected" : ""}>${m.label}</option>`,
  ).join("");
}

function renderUriRows(uris: ExtVaultEditorItem["uris"]): string {
  const rows = uris.length > 0 ? uris : [{ uri: "", match: "domain" as const }];
  return rows
    .map(
      (u, i) => `
      <div class="uri-row" data-uri-row="${i}">
        <input type="url" class="uri-input" data-uri="${i}" value="${escapeHtml(u.uri)}" placeholder="https://…" />
        <select data-uri-match="${i}" aria-label="匹配方式">${matchSelect(u.match)}</select>
        <button type="button" class="icon-btn" data-uri-remove="${i}" title="删除">×</button>
      </div>`,
    )
    .join("");
}

function renderEditorBody(draft: ExtVaultEditorItem): string {
  const isNew = draft.id == null;
  const type = draft.item_type;
  return `
    <div class="header">
      <div class="header-actions">
        <button type="button" class="icon-btn" id="editor-back" title="返回">←</button>
      </div>
      <h1>${isNew ? "新建条目" : "编辑条目"}</h1>
      <div class="header-actions">
        ${!isNew ? `<button type="button" class="icon-btn danger-text" id="editor-delete" title="删除">🗑</button>` : `<span style="width:32px"></span>`}
      </div>
    </div>
    <div class="main">
      <div class="main-scroll editor-form">
        <div class="field">
          <label for="ed-type">类型</label>
          <select id="ed-type">
            <option value="login" ${type === "login" ? "selected" : ""}>登录</option>
            <option value="secure_note" ${type === "secure_note" ? "selected" : ""}>安全笔记</option>
            <option value="card" ${type === "card" ? "selected" : ""}>卡片</option>
            <option value="identity" ${type === "identity" ? "selected" : ""}>身份</option>
            <option value="custom" ${type === "custom" ? "selected" : ""}>自定义</option>
          </select>
        </div>
        <div class="field">
          <label for="ed-title">标题</label>
          <input id="ed-title" type="text" value="${escapeHtml(draft.title)}" />
        </div>
        ${
          type === "login" || type === "custom"
            ? `<div class="field">
                <label for="ed-user">用户名</label>
                <input id="ed-user" type="text" autocomplete="username" value="${escapeHtml(draft.username)}" />
              </div>
              <div class="field">
                <label for="ed-pass">密码</label>
                <div class="input-row">
                  <input id="ed-pass" type="password" autocomplete="new-password" value="${escapeHtml(draft.password)}" />
                  <button type="button" class="btn secondary" id="ed-gen-pass">生成</button>
                </div>
              </div>
              <div class="field">
                <label for="ed-totp">TOTP 密钥</label>
                <input id="ed-totp" type="text" value="${escapeHtml(draft.totp)}" placeholder="可选" />
              </div>`
            : ""
        }
        <div class="field">
          <label>URI（多平台可添加多条）</label>
          <div id="uri-list">${renderUriRows(draft.uris)}</div>
          <button type="button" class="btn secondary" id="ed-add-uri" style="margin-top:6px">添加 URI</button>
        </div>
        <div class="field">
          <label for="ed-notes">${type === "secure_note" ? "笔记" : "备注"}</label>
          <textarea id="ed-notes" rows="3">${escapeHtml(draft.notes)}</textarea>
        </div>
        <div class="field">
          <label for="ed-tags">标签（逗号分隔）</label>
          <input id="ed-tags" type="text" value="${escapeHtml(draft.tags.join(", "))}" />
        </div>
        ${editorError ? `<div class="error">${escapeHtml(editorError)}</div>` : ""}
        <div class="row">
          <button type="button" class="btn" id="editor-save">保存</button>
          <button type="button" class="btn secondary" id="editor-cancel">取消</button>
        </div>
      </div>
    </div>`;
}

function readEditorForm(base: ExtVaultEditorItem): ExtVaultEditorItem {
  const item_type = ((document.getElementById("ed-type") as HTMLSelectElement | null)?.value ??
    base.item_type) as VaultItemType;
  const title = (document.getElementById("ed-title") as HTMLInputElement | null)?.value ?? "";
  const username = (document.getElementById("ed-user") as HTMLInputElement | null)?.value ?? "";
  const password = (document.getElementById("ed-pass") as HTMLInputElement | null)?.value ?? "";
  const totp = (document.getElementById("ed-totp") as HTMLInputElement | null)?.value ?? "";
  const notes = (document.getElementById("ed-notes") as HTMLTextAreaElement | null)?.value ?? "";
  const tagsRaw = (document.getElementById("ed-tags") as HTMLInputElement | null)?.value ?? "";
  const uriInputs = [...document.querySelectorAll<HTMLInputElement>("[data-uri]")];
  const uris = uriInputs.map((input) => {
    const i = Number(input.getAttribute("data-uri"));
    const matchEl = document.querySelector<HTMLSelectElement>(`[data-uri-match="${i}"]`);
    return {
      uri: input.value.trim(),
      match: (matchEl?.value ?? "domain") as VaultUriMatch,
    };
  });
  return {
    ...base,
    item_type,
    title,
    username,
    password,
    totp,
    notes,
    tags: tagsRaw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean),
    uris,
    url: uris.find((u) => u.uri)?.uri ?? "",
  };
}

async function openEditor(itemId: number | null): Promise<void> {
  editorError = "";
  if (itemId == null) {
    editorDraft = emptyEditorDraft(await activeTabUrl());
  } else {
    const res = await sendBg({ type: "get_item", item_id: itemId });
    if (!res.ok || !("editor" in res)) {
      editorError = res.ok ? "加载失败" : res.error;
      editorDraft = emptyEditorDraft("");
      if (editorDraft) editorDraft.id = itemId;
    } else {
      editorDraft = res.editor;
    }
  }
  screen = { kind: "editor", itemId };
  await renderEditor();
}

async function closeEditor(): Promise<void> {
  screen = { kind: "main" };
  editorDraft = null;
  editorError = "";
  activeTab = "vault";
  await renderShell(true);
}

async function renderEditor(): Promise<void> {
  if (!editorDraft) {
    await closeEditor();
    return;
  }
  rootEl.innerHTML = `<div class="shell">${renderEditorBody(editorDraft)}</div>`;
  bindEditorEvents();
}

function bindEditorEvents(): void {
  if (!editorDraft) return;
  document.getElementById("editor-back")?.addEventListener("click", () => {
    void closeEditor();
  });
  document.getElementById("editor-cancel")?.addEventListener("click", () => {
    void closeEditor();
  });
  document.getElementById("ed-type")?.addEventListener("change", () => {
    if (!editorDraft) return;
    editorDraft = readEditorForm(editorDraft);
    void renderEditor();
  });
  document.getElementById("ed-add-uri")?.addEventListener("click", () => {
    if (!editorDraft) return;
    editorDraft = readEditorForm(editorDraft);
    editorDraft.uris = [...editorDraft.uris, { uri: "", match: "domain" }];
    void renderEditor();
  });
  for (const btn of rootEl.querySelectorAll<HTMLButtonElement>("[data-uri-remove]")) {
    btn.addEventListener("click", () => {
      if (!editorDraft) return;
      editorDraft = readEditorForm(editorDraft);
      const i = Number(btn.getAttribute("data-uri-remove"));
      editorDraft.uris = editorDraft.uris.filter((_, idx) => idx !== i);
      if (editorDraft.uris.length === 0) {
        editorDraft.uris = [{ uri: "", match: "domain" }];
      }
      void renderEditor();
    });
  }
  document.getElementById("ed-gen-pass")?.addEventListener("click", () => {
    void (async () => {
      const res = await sendBg({
        type: "generate_password",
        length: 20,
        upper: true,
        lower: true,
        digits: true,
        symbols: true,
      });
      if (!res.ok || !("password" in res) || !editorDraft) return;
      editorDraft = readEditorForm(editorDraft);
      editorDraft.password = res.password;
      void renderEditor();
    })();
  });
  document.getElementById("editor-save")?.addEventListener("click", () => {
    void (async () => {
      if (!editorDraft) return;
      const draft = readEditorForm(editorDraft);
      editorDraft = draft;
      editorError = "";
      const res = await sendBg({
        type: "save_item",
        ...(draft.id != null ? { id: draft.id } : {}),
        title: draft.title,
        item_type: draft.item_type,
        username: draft.username,
        url: draft.url,
        uris: draft.uris.filter((u) => u.uri),
        tags: draft.tags,
        password: draft.password,
        notes: draft.notes,
        totp: draft.totp,
      });
      if (!res.ok) {
        editorError = res.error;
        void renderEditor();
        return;
      }
      await closeEditor();
    })();
  });
  document.getElementById("editor-delete")?.addEventListener("click", () => {
    void (async () => {
      if (!editorDraft?.id) return;
      if (!confirm("确定删除该条目？此操作不可恢复。")) return;
      const res = await sendBg({ type: "delete_item", item_id: editorDraft.id });
      if (!res.ok) {
        editorError = res.error;
        void renderEditor();
        return;
      }
      await closeEditor();
    })();
  });
}

function renderGate(html: string): void {
  rootEl.innerHTML = `<div class="gate">${html}</div>`;
}

function tabBar(): string {
  const tabs: Array<{ id: TabId; label: string; ico: string }> = [
    { id: "vault", label: "密码库", ico: "▣" },
    { id: "generator", label: "生成器", ico: "↻" },
    { id: "options", label: "选项", ico: "⚙" },
  ];
  return `
    <nav class="tabs">
      ${tabs
        .map(
          (t) => `
        <button type="button" class="tab ${activeTab === t.id ? "active" : ""}" data-tab="${t.id}">
          <span class="ico">${t.ico}</span>
          <span>${t.label}</span>
        </button>`,
        )
        .join("")}
    </nav>`;
}

function renderVaultBody(): string {
  const items = filteredItems();
  const matched = items.filter((i) => i.matched);
  const rest = items.filter((i) => !i.matched);

  const renderRow = (item: ExtVaultListItem): string => `
    <li class="list-item ${item.matched ? "matched" : ""}" data-row="${item.id}">
      <button type="button" class="item-main" data-fill="${item.id}">
        <div class="item-title">
          ${escapeHtml(item.title)}
          ${item.matched ? '<span class="badge">匹配</span>' : ""}
        </div>
        <div class="item-sub">${escapeHtml(item.username ?? item.url ?? item.item_type)}</div>
      </button>
      <div class="item-actions">
        ${
          item.url
            ? `<button type="button" title="打开链接" data-open="${escapeHtml(item.url)}">↗</button>`
            : ""
        }
        <button type="button" title="复制密码" data-copy-pass="${item.id}">⧉</button>
        <button type="button" title="更多" data-menu="${item.id}">⋮</button>
        ${
          openMenuId === item.id
            ? `<div class="menu">
                <button type="button" data-edit="${item.id}">编辑</button>
                <button type="button" data-copy-user="${item.id}">复制用户名</button>
                <button type="button" data-copy-pass="${item.id}">复制密码</button>
                <button type="button" data-copy-totp="${item.id}">复制验证码</button>
                <button type="button" data-fill="${item.id}">填充到页面</button>
              </div>`
            : ""
        }
      </div>
    </li>`;

  return `
    <div class="header">
      <h1>密码库</h1>
      <div class="header-actions">
        <button type="button" class="icon-btn" id="new-item" title="新建">＋</button>
        <button type="button" class="icon-btn" id="lock" title="锁定">🔒</button>
      </div>
    </div>
    <div class="main">
      <div class="main-scroll">
        <div class="search-row">
          <div class="search-wrap">
            <input id="search" type="search" placeholder="搜索…" value="${escapeHtml(searchQuery)}" />
            ${
              searchQuery
                ? `<button type="button" class="search-clear" id="search-clear" aria-label="清除">×</button>`
                : ""
            }
          </div>
          <select id="type-filter" class="filter" aria-label="类型">
            <option value="all" ${typeFilter === "all" ? "selected" : ""}>全部类型</option>
            <option value="login" ${typeFilter === "login" ? "selected" : ""}>登录</option>
            <option value="secure_note" ${typeFilter === "secure_note" ? "selected" : ""}>安全笔记</option>
            <option value="card" ${typeFilter === "card" ? "selected" : ""}>卡片</option>
            <option value="identity" ${typeFilter === "identity" ? "selected" : ""}>身份</option>
            <option value="custom" ${typeFilter === "custom" ? "selected" : ""}>自定义</option>
          </select>
        </div>
        ${listError ? `<div class="error">${escapeHtml(listError)}</div>` : ""}
        ${
          items.length === 0
            ? `<div class="empty">${allItems.length === 0 ? "保险库为空" : "无匹配结果"}</div>`
            : `
          ${
            matched.length > 0
              ? `<div class="section-label"><span>当前网站</span><span>${matched.length}</span></div>
                 <ul class="list">${matched.map(renderRow).join("")}</ul>`
              : ""
          }
          <div class="section-label"><span>${matched.length > 0 ? "全部条目" : "条目"}</span><span>${rest.length > 0 ? rest.length : items.length}</span></div>
          <ul class="list">${(matched.length > 0 ? rest : items).map(renderRow).join("")}</ul>
        `
        }
      </div>
    </div>`;
}

function renderGeneratorBody(): string {
  return `
    <div class="header">
      <h1>生成器</h1>
    </div>
    <div class="main">
      <div class="main-scroll">
        <div class="gen-out">
          <code id="gen-out">${escapeHtml(genPassword || "—")}</code>
          <button type="button" class="icon-btn" id="gen-refresh" title="重新生成">↻</button>
          <button type="button" class="icon-btn" id="gen-copy" title="复制">⧉</button>
        </div>
        <div class="field">
          <label for="gen-len">长度（5–128）</label>
          <input id="gen-len" type="number" min="5" max="128" value="${genLength}" />
        </div>
        <div class="muted">建议 14 位以上以获得更强密码。</div>
        <div class="checks">
          <label><input type="checkbox" id="gen-upper" ${genUpper ? "checked" : ""} /> A-Z</label>
          <label><input type="checkbox" id="gen-lower" ${genLower ? "checked" : ""} /> a-z</label>
          <label><input type="checkbox" id="gen-digits" ${genDigits ? "checked" : ""} /> 0-9</label>
          <label><input type="checkbox" id="gen-symbols" ${genSymbols ? "checked" : ""} /> !@#$%^&*</label>
        </div>
        <div class="row">
          <button type="button" class="btn" id="gen-fill">填入焦点字段</button>
          <button type="button" class="btn secondary" id="gen-now">生成</button>
        </div>
      </div>
    </div>`;
}

async function renderOptionsBody(): Promise<string> {
  const settings = await loadSettings();
  return `
    <div class="header">
      <h1>选项</h1>
    </div>
    <div class="main">
      <div class="main-scroll">
        <p class="muted">直连 Habitat。解锁态最多保留 8 小时，或浏览器关闭后需重新输入主密码。</p>
        <div class="field">
          <label for="opt-url">Habitat URL</label>
          <input id="opt-url" type="url" value="${escapeHtml(settings.habitat_url)}" placeholder="http://127.0.0.1:2658" />
        </div>
        <div class="field">
          <label for="opt-token">API Token</label>
          <input id="opt-token" type="password" value="${escapeHtml(settings.auth_token)}" placeholder="fa_at_…" />
        </div>
        <div class="row">
          <button type="button" class="btn" id="opt-save">保存</button>
          <button type="button" class="btn secondary" id="opt-test">测试连接</button>
          <button type="button" class="btn secondary" id="opt-lock">锁定保险库</button>
        </div>
        <div id="opt-msg" class="muted"></div>
      </div>
    </div>`;
}

function bindTabs(): void {
  for (const btn of rootEl.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab as TabId;
      openMenuId = null;
      void (async () => {
        if (activeTab === "vault") {
          const status = await sendBg({ type: "get_status" });
          if (status.ok && "unlocked" in status && !status.unlocked) {
            await render();
            return;
          }
        }
        await renderShell();
      })();
    });
  }
}

function bindVaultEvents(): void {
  document.getElementById("lock")?.addEventListener("click", () => {
    void sendBg({ type: "lock" }).then(() => render());
  });
  document.getElementById("new-item")?.addEventListener("click", () => {
    void openEditor(null);
  });
  const search = document.getElementById("search") as HTMLInputElement | null;
  search?.addEventListener("input", () => {
    searchQuery = search.value;
    openMenuId = null;
    const start = search.selectionStart;
    const end = search.selectionEnd;
    void renderShell(false).then(() => {
      const again = document.getElementById("search") as HTMLInputElement | null;
      if (!again) return;
      again.focus();
      if (start != null && end != null) again.setSelectionRange(start, end);
    });
  });
  document.getElementById("search-clear")?.addEventListener("click", () => {
    searchQuery = "";
    void renderShell(false).then(() => {
      document.getElementById("search")?.focus();
    });
  });
  const typeSel = document.getElementById("type-filter") as HTMLSelectElement | null;
  typeSel?.addEventListener("change", () => {
    typeFilter = typeSel.value;
    openMenuId = null;
    void renderShell(false);
  });

  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-fill]")) {
    el.addEventListener("click", () => {
      void fillItem(Number(el.getAttribute("data-fill")));
    });
  }
  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-edit]")) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      void openEditor(Number(el.getAttribute("data-edit")));
    });
  }
  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-copy-pass]")) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      void copyField(Number(el.getAttribute("data-copy-pass")), "password");
    });
  }
  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-copy-user]")) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      void copyField(Number(el.getAttribute("data-copy-user")), "username");
    });
  }
  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-copy-totp]")) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      void copyField(Number(el.getAttribute("data-copy-totp")), "totp");
    });
  }
  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-open]")) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = el.getAttribute("data-open");
      if (url) void chrome.tabs.create({ url });
    });
  }
  for (const el of rootEl.querySelectorAll<HTMLElement>("[data-menu]")) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(el.getAttribute("data-menu"));
      openMenuId = openMenuId === id ? null : id;
      void renderShell(false);
    });
  }
}

function bindGeneratorEvents(): void {
  const syncOpts = () => {
    const lenEl = document.getElementById("gen-len") as HTMLInputElement | null;
    genLength = Math.min(128, Math.max(5, Number(lenEl?.value ?? 16) || 16));
    genUpper = Boolean((document.getElementById("gen-upper") as HTMLInputElement | null)?.checked);
    genLower = Boolean((document.getElementById("gen-lower") as HTMLInputElement | null)?.checked);
    genDigits = Boolean(
      (document.getElementById("gen-digits") as HTMLInputElement | null)?.checked,
    );
    genSymbols = Boolean(
      (document.getElementById("gen-symbols") as HTMLInputElement | null)?.checked,
    );
  };
  document.getElementById("gen-refresh")?.addEventListener("click", () => {
    syncOpts();
    void regeneratePassword().then(() => renderShell(false));
  });
  document.getElementById("gen-now")?.addEventListener("click", () => {
    syncOpts();
    void regeneratePassword().then(() => renderShell(false));
  });
  document.getElementById("gen-copy")?.addEventListener("click", () => {
    if (genPassword) void navigator.clipboard.writeText(genPassword);
  });
  document.getElementById("gen-fill")?.addEventListener("click", () => {
    void (async () => {
      syncOpts();
      if (!genPassword) await regeneratePassword();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !genPassword) return;
      await chrome.tabs.sendMessage(tab.id, {
        type: "fill_password_only",
        password: genPassword,
      });
    })();
  });
  for (const id of ["gen-len", "gen-upper", "gen-lower", "gen-digits", "gen-symbols"]) {
    document.getElementById(id)?.addEventListener("change", () => {
      syncOpts();
    });
  }
}

function bindOptionsEvents(): void {
  document.getElementById("opt-save")?.addEventListener("click", () => {
    void (async () => {
      const url = (document.getElementById("opt-url") as HTMLInputElement).value;
      const token = (document.getElementById("opt-token") as HTMLInputElement).value;
      await saveSettings({ habitat_url: url, auth_token: token });
      const msg = document.getElementById("opt-msg");
      if (msg) {
        msg.className = "ok";
        msg.textContent = "已保存";
      }
    })();
  });
  document.getElementById("opt-test")?.addEventListener("click", () => {
    void (async () => {
      const url = (document.getElementById("opt-url") as HTMLInputElement).value;
      const token = (document.getElementById("opt-token") as HTMLInputElement).value;
      await saveSettings({ habitat_url: url, auth_token: token });
      const res = await sendBg({ type: "test_connection" });
      const msg = document.getElementById("opt-msg");
      if (!msg) return;
      if (res.ok && "message" in res) {
        msg.className = "ok";
        msg.textContent = res.message;
      } else if (!res.ok) {
        msg.className = "error";
        msg.textContent = res.error;
      }
    })();
  });
  document.getElementById("opt-lock")?.addEventListener("click", () => {
    void sendBg({ type: "lock" }).then(() => render());
  });
}

async function renderShell(reloadList = true): Promise<void> {
  if (activeTab === "vault" && reloadList) {
    const listState = await refreshVaultList();
    if (listState === "vault_locked") {
      await render();
      return;
    }
  }
  if (activeTab === "generator" && !genPassword) {
    await regeneratePassword();
  }

  let body = "";
  if (activeTab === "vault") body = renderVaultBody();
  else if (activeTab === "generator") body = renderGeneratorBody();
  else body = await renderOptionsBody();

  rootEl.innerHTML = `<div class="shell">${body}${tabBar()}</div>`;
  bindTabs();
  if (activeTab === "vault") bindVaultEvents();
  if (activeTab === "generator") bindGeneratorEvents();
  if (activeTab === "options") bindOptionsEvents();

  if (activeTab === "vault") {
    const search = document.getElementById("search") as HTMLInputElement | null;
    if (search && document.activeElement !== search) {
      // keep caret if user is typing: only restore value (already in HTML)
    }
  }
}

async function render(): Promise<void> {
  const status = await sendBg({ type: "get_status" });
  if (!status.ok) {
    renderGate(`<p class="error">${escapeHtml(status.error)}</p>`);
    return;
  }
  if (!("unlocked" in status)) return;

  if (!status.habitat_configured) {
    activeTab = "options";
    await renderShell(false);
    const msg = document.getElementById("opt-msg");
    if (msg) {
      msg.className = "error";
      msg.textContent = "请先配置 Habitat URL 与 API Token";
    }
    return;
  }

  if (!status.unlocked) {
    screen = { kind: "main" };
    editorDraft = null;
    renderGate(`
      <h1>解锁保险库</h1>
      <p class="muted">输入用户库主密码。解锁后最多保留 8 小时；关闭浏览器后需重新输入。</p>
      <div class="field">
        <label for="mp">主密码</label>
        <input id="mp" type="password" autocomplete="current-password" />
      </div>
      <div class="row">
        <button type="button" class="btn" id="unlock">解锁</button>
        <button type="button" class="btn secondary" id="goto-options">选项</button>
      </div>
      <div id="err" class="error"></div>
    `);
    document.getElementById("goto-options")?.addEventListener("click", () => {
      activeTab = "options";
      void renderShell(false);
    });
    const doUnlock = (): void => {
      void (async () => {
        const mp = (document.getElementById("mp") as HTMLInputElement | null)?.value ?? "";
        const res = await sendBg({ type: "unlock", master_password: mp });
        if (!res.ok) {
          const err = document.getElementById("err");
          if (err) err.textContent = res.error;
          return;
        }
        activeTab = "vault";
        await renderShell(true);
      })();
    };
    document.getElementById("unlock")?.addEventListener("click", doUnlock);
    document.getElementById("mp")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doUnlock();
      }
    });
    document.getElementById("mp")?.focus();
    return;
  }

  if (screen.kind === "editor") {
    if (!editorDraft) {
      await openEditor(screen.itemId);
      return;
    }
    await renderEditor();
    return;
  }

  await renderShell(true);
}

void render();
