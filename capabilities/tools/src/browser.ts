import { getToolSessionId } from "@freeanima/core/tool";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError } from "@freeanima/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

import {
  camofoxBack,
  camofoxClick,
  camofoxConsole,
  camofoxGetImages,
  camofoxNavigate,
  camofoxPress,
  camofoxScroll,
  camofoxSnapshot,
  camofoxType,
  camofoxVision,
  isCamofoxConfigured,
} from "./browser-camofox.ts";

function sessionKey(): string {
  return getToolSessionId() ?? "default";
}

export function registerBrowserTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "browser",
    "Browser automation",
    attachToolReturns(
      [
        {
          name: "browser_navigate",
          description:
            "Open a URL in the browser. Call this tool first before using other browser_* tools. For plain text/API pages prefer web_extract or terminal curl; use the browser when interaction is needed (clicks, forms, dynamic content). Returns a compact snapshot with element refs; usually no separate browser_snapshot is needed.",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "Target URL, e.g. https://example.com" },
            },
            required: ["url"],
          },
          handler: (args) => {
            const url = String(args.url ?? "").trim();
            if (!url) return toolError("url is required");
            if (!isCamofoxConfigured()) {
              return toolError(
                "Camofox not configured. Set browser.camofox.base_url in ~/.anima/config.yaml.",
              );
            }
            return camofoxNavigate(sessionKey(), url);
          },
        },
        {
          name: "browser_snapshot",
          description:
            "Get an accessibility tree text snapshot of the current page with interactive element refs (e.g. @e1). full=false is compact view; full=true is full content. Truncated at ~8000 chars. browser_navigate already includes a compact snapshot; call this after interactions change the page.",
          parameters: {
            type: "object",
            properties: {
              full: {
                type: "boolean",
                description: "true=full page; false=compact interactive elements view",
                default: false,
              },
            },
            required: [],
          },
          handler: (args) => camofoxSnapshot(sessionKey(), Boolean(args.full)),
        },
        {
          name: "browser_click",
          description:
            "Click the element identified by ref in the snapshot (e.g. @e5). Requires browser_navigate first.",
          parameters: {
            type: "object",
            properties: {
              ref: { type: "string", description: "Element ref from snapshot, e.g. @e5" },
            },
            required: ["ref"],
          },
          handler: (args) => {
            const ref = String(args.ref ?? "").trim();
            if (!ref) return toolError("ref is required");
            return camofoxClick(sessionKey(), ref);
          },
        },
        {
          name: "browser_type",
          description:
            "Type text into the input identified by ref (clears first). Requires browser_navigate first.",
          parameters: {
            type: "object",
            properties: {
              ref: { type: "string", description: "Input ref, e.g. @e3" },
              text: { type: "string", description: "Text to type" },
            },
            required: ["ref", "text"],
          },
          handler: (args) => {
            const ref = String(args.ref ?? "").trim();
            if (!ref) return toolError("ref is required");
            return camofoxType(sessionKey(), ref, String(args.text ?? ""));
          },
        },
        {
          name: "browser_scroll",
          description: "Scroll the page (up/down). Requires browser_navigate first.",
          parameters: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["up", "down"], description: "Scroll direction" },
            },
            required: ["direction"],
          },
          handler: (args) => camofoxScroll(sessionKey(), String(args.direction ?? "")),
        },
        {
          name: "browser_back",
          description: "Browser back navigation. Requires browser_navigate first.",
          parameters: { type: "object", properties: {}, required: [] },
          handler: () => camofoxBack(sessionKey()),
        },
        {
          name: "browser_press",
          description:
            "Press a keyboard key (Enter, Tab, Escape, etc.). Requires browser_navigate first.",
          parameters: {
            type: "object",
            properties: {
              key: { type: "string", description: "Key name, e.g. Enter, Tab" },
            },
            required: ["key"],
          },
          handler: (args) => {
            const key = String(args.key ?? "").trim();
            if (!key) return toolError("key is required");
            return camofoxPress(sessionKey(), key);
          },
        },
        {
          name: "browser_console",
          description:
            "Read browser console and JS errors. Camofox backend returns empty results with a note; use browser_snapshot to inspect the page.",
          parameters: {
            type: "object",
            properties: {
              clear: { type: "boolean", default: false, description: "Clear buffer after reading" },
            },
            required: [],
          },
          handler: (args) => camofoxConsole(sessionKey(), Boolean(args.clear)),
        },
        {
          name: "browser_get_images",
          description:
            "List image URLs and alt text on the current page. Requires browser_navigate first.",
          parameters: { type: "object", properties: {}, required: [] },
          handler: () => camofoxGetImages(sessionKey()),
        },
        {
          name: "browser_vision",
          description:
            "Capture current page as PNG and save to ~/.anima/browser_screenshots/. When annotate=true, attach accessibility tree summary. Vision LLM analysis not yet integrated; returns screenshot_path.",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "What to learn from the screenshot (for future vision integration)",
              },
              annotate: {
                type: "boolean",
                default: false,
                description: "Attach snapshot summary as annotation context",
              },
            },
            required: ["question"],
          },
          handler: (args) =>
            camofoxVision(sessionKey(), String(args.question ?? ""), Boolean(args.annotate)),
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
