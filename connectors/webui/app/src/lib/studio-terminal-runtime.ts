import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import {
  subscribeTerminalStream,
  terminalClose,
  terminalResize,
  terminalWrite,
} from "@/lib/api.ts";

const STASH_ID = "anima-studio-terminal-stash";

type StatusHandler = (msg: string) => void;

function ensureStashEl(): HTMLDivElement {
  let el = document.getElementById(STASH_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = STASH_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;";
    document.body.appendChild(el);
  }
  return el;
}

/** 创作室 xterm 单例：路由切换时 stash DOM，避免 dispose 与 Viewport rAF 竞态 */
class StudioTerminalRuntime {
  private term: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private container: HTMLDivElement | null = null;
  private alive = false;
  private fitRafId: number | null = null;
  private ro: ResizeObserver | null = null;
  private onDataDisposable: { dispose: () => void } | null = null;
  private unsubRef: (() => void) | null = null;
  private sessionId: string | null = null;
  private onStatus: StatusHandler = () => {};
  private statusMsg = "";

  attach(container: HTMLDivElement, onStatus: StatusHandler): void {
    this.onStatus = onStatus;
    this.container = container;
    this.alive = true;
    if (this.statusMsg) {
      onStatus(this.statusMsg);
    }

    if (!this.term) {
      this.createTerminal();
    }

    const element = this.term!.element;
    if (element && element.parentElement !== container) {
      container.appendChild(element);
    }

    this.bindInput();
    this.bindResizeObserver();
    this.scheduleFit();
    this.connect();
  }

  detach(): void {
    this.alive = false;
    this.unbindResizeObserver();
    this.onDataDisposable?.dispose();
    this.onDataDisposable = null;
    this.unsubRef?.();
    this.unsubRef = null;
    if (this.sessionId) {
      void terminalClose(this.sessionId);
      this.sessionId = null;
    }
    this.moveToStash();
    this.container = null;
  }

  reconnect(): void {
    if (!this.alive || !this.term) return;
    this.term.clear();
    this.connect();
  }

  disposeAll(): void {
    this.detach();
    this.term?.dispose();
    this.term = null;
    this.fitAddon = null;
    document.getElementById(STASH_ID)?.remove();
  }

  private createTerminal(): void {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.2,
      fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace',
      convertEol: true,
      scrollback: 5000,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(ensureStashEl());
    this.term = term;
    this.fitAddon = fitAddon;
  }

  private moveToStash(): void {
    const element = this.term?.element;
    if (!element) return;
    const stash = ensureStashEl();
    if (element.parentElement !== stash) {
      stash.appendChild(element);
    }
  }

  private bindInput(): void {
    this.onDataDisposable?.dispose();
    this.onDataDisposable = this.term!.onData((data) => {
      if (!this.alive || !this.sessionId) return;
      void terminalWrite(this.sessionId, data);
    });
  }

  private bindResizeObserver(): void {
    this.unbindResizeObserver();
    const container = this.container;
    if (!container) return;
    const ro = new ResizeObserver(() => this.scheduleFit());
    ro.observe(container);
    this.ro = ro;
  }

  private unbindResizeObserver(): void {
    this.ro?.disconnect();
    this.ro = null;
    if (this.fitRafId !== null) {
      cancelAnimationFrame(this.fitRafId);
      this.fitRafId = null;
    }
  }

  private scheduleFit(): void {
    if (!this.alive) return;
    if (this.fitRafId !== null) cancelAnimationFrame(this.fitRafId);
    this.fitRafId = requestAnimationFrame(() => {
      this.fitRafId = null;
      this.fitTerminal();
    });
  }

  private fitTerminal(): void {
    const container = this.container;
    const term = this.term;
    const fitAddon = this.fitAddon;
    if (!this.alive || !container || !term || !fitAddon || !container.isConnected) return;
    const { clientWidth, clientHeight } = container;
    if (clientWidth <= 0 || clientHeight <= 0) return;
    try {
      fitAddon.fit();
      if (this.sessionId) {
        void terminalResize(this.sessionId, term.cols, term.rows);
      }
    } catch {
      /* 容器尺寸为 0 时忽略 */
    }
  }

  private setStatus(msg: string): void {
    this.statusMsg = msg;
    this.onStatus(msg);
  }

  private connect(): void {
    this.unsubRef?.();
    this.unsubRef = null;
    this.sessionId = null;
    this.setStatus("");

    const sub = subscribeTerminalStream({
      onData: (msg) => {
        if (!this.alive) return;
        if (msg.type === "ready" && msg.sessionId) {
          this.sessionId = msg.sessionId;
          this.scheduleFit();
        } else if (msg.type === "output" && msg.data !== undefined) {
          this.term?.write(msg.data);
        } else if (msg.type === "error" && msg.message) {
          this.setStatus(msg.message);
        } else if (msg.type === "exit" && msg.code !== undefined) {
          this.setStatus(`进程退出 (${msg.code})`);
        }
      },
      onError: () => {
        if (this.alive) this.setStatus("WebSocket 连接失败");
      },
      onComplete: () => {
        if (this.alive) this.setStatus(this.statusMsg || "连接已断开");
      },
    });
    this.unsubRef = () => sub.unsubscribe();
  }
}

let runtime: StudioTerminalRuntime | null = null;
let pageUnloadHooked = false;

export function getStudioTerminalRuntime(): StudioTerminalRuntime {
  if (!runtime) {
    runtime = new StudioTerminalRuntime();
  }
  if (typeof window !== "undefined" && !pageUnloadHooked) {
    pageUnloadHooked = true;
    window.addEventListener("pagehide", () => runtime?.disposeAll());
  }
  return runtime;
}
