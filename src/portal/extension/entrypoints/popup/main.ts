import { sendBg, type ExtVaultListItem } from "../../runtime/messages.ts";
import { loadSettings, saveSettings } from "../../runtime/settings.ts";

type TabId = "vault" | "generator" | "options";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

let activeTab: TabId = "vault";
let allItems: ExtVaultListItem[] = [];
let searchQuery = "";
let typeFilter = "all";
let openMenuId: number | null = null;
let listError = "";
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

async function refreshVaultList(): Promise<void> {
  const tabUrl = await activeTabUrl();
  const listRes = await sendBg({ type: "list_for_tab", tab_url: tabUrl });
  if (!listRes.ok) {
    listError = listRes.error;
    allItems = [];
    return;
  }
  listError = "";
  allItems = "items" in listRes ? listRes.items : [];
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
        <p class="muted">直连 Habitat；主密码仅保存在扩展内存（约 15 分钟）。</p>
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
      void renderShell();
    });
  }
}

function bindVaultEvents(): void {
  document.getElementById("lock")?.addEventListener("click", () => {
    void sendBg({ type: "lock" }).then(() => render());
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
    await refreshVaultList();
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
    renderGate(`
      <h1>解锁保险库</h1>
      <p class="muted">输入用户库主密码（仅保存在扩展内存）</p>
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
    document.getElementById("unlock")?.addEventListener("click", () => {
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
    });
    return;
  }

  await renderShell(true);
}

void render();
