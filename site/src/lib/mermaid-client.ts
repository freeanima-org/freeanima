import mermaid from "mermaid";
import { faMermaidThemeDark, faMermaidThemeLight } from "./mermaid-theme.ts";

const MERMAID_FLOWCHART = { htmlLabels: true, curve: "basis" } as const;

function resolveThemeVars(): Record<string, string | boolean> {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? faMermaidThemeLight
    : faMermaidThemeDark;
}

function initMermaidEngine(): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: resolveThemeVars(),
    flowchart: MERMAID_FLOWCHART,
  });
}

async function renderDiagram(pre: HTMLPreElement): Promise<void> {
  if (!pre.hasAttribute("data-diagram")) {
    pre.setAttribute("data-diagram", pre.textContent ?? "");
  }
  const definition = (pre.getAttribute("data-diagram") ?? "").trim();
  if (!definition) return;

  pre.removeAttribute("data-processed");
  const id = "mermaid-" + Math.random().toString(36).slice(2, 11);

  try {
    const { svg } = await mermaid.render(id, definition);
    pre.innerHTML = svg;
    pre.setAttribute("data-processed", "true");
  } catch (error) {
    console.error("[mermaid-client]", error);
  }
}

async function renderAllDiagrams(): Promise<void> {
  const diagrams = document.querySelectorAll<HTMLPreElement>("pre.mermaid");
  if (diagrams.length === 0) return;

  initMermaidEngine();
  for (const diagram of diagrams) {
    await renderDiagram(diagram);
  }
  enhanceDiagrams();
}

function ensureLightbox(): HTMLElement {
  let root = document.getElementById("fa-mermaid-lightbox");
  if (root) return root;

  root = document.createElement("div");
  root.id = "fa-mermaid-lightbox";
  root.className = "fa-mermaid-lightbox";
  root.hidden = true;
  root.innerHTML = `
    <div class="fa-mermaid-lightbox__backdrop" data-fa-mermaid-close></div>
    <div class="fa-mermaid-lightbox__panel" role="dialog" aria-modal="true" aria-label="Mermaid diagram">
      <div class="fa-mermaid-lightbox__toolbar">
        <button type="button" class="fa-mermaid-lightbox__btn" data-fa-mermaid-zoom="out" aria-label="缩小">−</button>
        <button type="button" class="fa-mermaid-lightbox__btn" data-fa-mermaid-zoom="reset" aria-label="重置缩放">100%</button>
        <button type="button" class="fa-mermaid-lightbox__btn" data-fa-mermaid-zoom="in" aria-label="放大">+</button>
        <button type="button" class="fa-mermaid-lightbox__btn fa-mermaid-lightbox__btn--close" data-fa-mermaid-close aria-label="关闭">×</button>
      </div>
      <div class="fa-mermaid-lightbox__viewport">
        <div class="fa-mermaid-lightbox__stage"></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  let scale = 1;
  const stage = root.querySelector<HTMLElement>(".fa-mermaid-lightbox__stage")!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-fa-mermaid-zoom="reset"]')!;

  const applyScale = (): void => {
    stage.style.transform = `scale(${scale})`;
    resetBtn.textContent = `${Math.round(scale * 100)}%`;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-fa-mermaid-close]")) {
      root.hidden = true;
      stage.innerHTML = "";
      scale = 1;
      applyScale();
      return;
    }
    const zoom = target.closest<HTMLElement>("[data-fa-mermaid-zoom]")?.dataset.faMermaidZoom;
    if (zoom === "in") {
      scale = Math.min(scale + 0.25, 4);
      applyScale();
    } else if (zoom === "out") {
      scale = Math.max(scale - 0.25, 0.25);
      applyScale();
    } else if (zoom === "reset") {
      scale = 1;
      applyScale();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (root.hidden || event.key !== "Escape") return;
    root.hidden = true;
    stage.innerHTML = "";
    scale = 1;
    applyScale();
  });

  return root;
}

function openLightbox(svg: SVGElement): void {
  const root = ensureLightbox();
  const stage = root.querySelector<HTMLElement>(".fa-mermaid-lightbox__stage")!;
  stage.innerHTML = "";
  stage.appendChild(svg.cloneNode(true) as SVGElement);
  root.hidden = false;
}

function wrapDiagram(pre: HTMLPreElement): void {
  if (pre.parentElement?.classList.contains("fa-mermaid-shell")) return;

  const shell = document.createElement("div");
  shell.className = "fa-mermaid-shell";
  pre.parentElement?.insertBefore(shell, pre);
  shell.append(pre);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fa-mermaid-zoom-btn";
  btn.setAttribute("aria-label", "放大查看图表");
  btn.textContent = "⤢";
  btn.addEventListener("click", () => {
    const svg = pre.querySelector("svg");
    if (svg) openLightbox(svg);
  });
  shell.append(btn);
}

function enhanceDiagrams(): void {
  document.querySelectorAll<HTMLPreElement>("pre.mermaid[data-processed]").forEach(wrapDiagram);
}

function waitForAstroMermaid(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const done = (): boolean => {
      const nodes = document.querySelectorAll<HTMLPreElement>("pre.mermaid");
      if (nodes.length === 0) return true;
      return [...nodes].every((node) => node.hasAttribute("data-processed"));
    };

    if (done()) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (done()) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-processed"],
    });
    window.setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeoutMs);
  });
}

async function bootInitial(): Promise<void> {
  if (!document.querySelector("pre.mermaid")) return;
  await waitForAstroMermaid();
  const pending = document.querySelector("pre.mermaid:not([data-processed])");
  if (pending) {
    await renderAllDiagrams();
    return;
  }
  enhanceDiagrams();
}

export function initMermaidClient(): void {
  if (!document.querySelector("pre.mermaid")) return;

  ensureLightbox();

  void bootInitial();

  document.addEventListener("astro:page-load", () => {
    void renderAllDiagrams();
  });

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        void renderAllDiagrams();
        break;
      }
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
