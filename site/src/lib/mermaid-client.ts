import mermaid from "mermaid";
import { faMermaidThemeDark, faMermaidThemeLight } from "./mermaid-theme.ts";

export type MermaidA11yLabels = {
  dialog: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  close: string;
  expand: string;
};

const DEFAULT_A11Y: MermaidA11yLabels = {
  dialog: "Mermaid diagram",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset zoom",
  close: "Close",
  expand: "Expand diagram",
};

let a11y: MermaidA11yLabels = DEFAULT_A11Y;

const MERMAID_FLOWCHART = { htmlLabels: true, curve: "basis" } as const;

function resolveThemeVars(): Record<string, string | boolean> {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? faMermaidThemeLight
    : faMermaidThemeDark;
}

function initMermaidEngine(): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: resolveThemeVars(),
    flowchart: MERMAID_FLOWCHART,
  });
}

function cacheDiagramSource(pre: HTMLPreElement): string {
  const cached = pre.getAttribute("data-diagram")?.trim();
  if (cached) return cached;
  const source = (pre.textContent ?? "").trim();
  if (source) pre.setAttribute("data-diagram", source);
  return source;
}

function restoreDiagramSource(pre: HTMLPreElement): boolean {
  const definition = cacheDiagramSource(pre);
  if (!definition) return false;
  pre.textContent = definition;
  return true;
}

async function renderAllDiagrams(): Promise<void> {
  const diagrams = document.querySelectorAll<HTMLPreElement>("pre.mermaid");
  if (diagrams.length === 0) return;

  initMermaidEngine();
  const nodes: HTMLPreElement[] = [];
  for (const pre of diagrams) {
    if (!restoreDiagramSource(pre)) continue;
    pre.removeAttribute("data-processed");
    nodes.push(pre);
  }
  if (nodes.length === 0) return;

  try {
    await mermaid.run({ nodes, suppressErrors: true });
  } catch (error) {
    console.error("[mermaid-client]", error);
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
    <div class="fa-mermaid-lightbox__panel" role="dialog" aria-modal="true" aria-label="${a11y.dialog}">
      <div class="fa-mermaid-lightbox__toolbar">
        <button type="button" class="fa-mermaid-lightbox__btn" data-fa-mermaid-zoom="out" aria-label="${a11y.zoomOut}">−</button>
        <button type="button" class="fa-mermaid-lightbox__btn" data-fa-mermaid-zoom="reset" aria-label="${a11y.zoomReset}">100%</button>
        <button type="button" class="fa-mermaid-lightbox__btn" data-fa-mermaid-zoom="in" aria-label="${a11y.zoomIn}">+</button>
        <button type="button" class="fa-mermaid-lightbox__btn fa-mermaid-lightbox__btn--close" data-fa-mermaid-close aria-label="${a11y.close}">×</button>
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
  btn.setAttribute("aria-label", a11y.expand);
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

function astroMermaidReady(): boolean {
  const nodes = document.querySelectorAll<HTMLPreElement>("pre.mermaid");
  if (nodes.length === 0) return true;
  return [...nodes].every((node) => node.hasAttribute("data-processed"));
}

function waitForAstroMermaid(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (astroMermaidReady()) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (astroMermaidReady()) {
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

export function initMermaidClient(labels?: MermaidA11yLabels): void {
  if (labels) a11y = labels;
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
