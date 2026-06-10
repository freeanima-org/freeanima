import { getToolSessionId } from "@freeanima/engine-loop";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { attachToolReturns, toolError } from "@freeanima/engine-tool";
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
    "浏览器自动化",
    attachToolReturns(
      [
        {
          name: "browser_navigate",
          description:
            "在浏览器中打开 URL。需先调用本工具再使用其他 browser_* 工具。纯文本/API 页面优先 web_extract 或 terminal curl；需要交互（点击、填表、动态内容）时用浏览器。返回紧凑 snapshot 与元素 ref，通常无需再单独 browser_snapshot。",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "目标 URL，如 https://example.com" },
            },
            required: ["url"],
          },
          handler: (args) => {
            const url = String(args.url ?? "").trim();
            if (!url) return toolError("url is required");
            if (!isCamofoxConfigured()) {
              return toolError(
                "未配置 Camofox。请在 ~/.anima/config.yaml 设置 browser.camofox.base_url。",
              );
            }
            return camofoxNavigate(sessionKey(), url);
          },
        },
        {
          name: "browser_snapshot",
          description:
            "获取当前页面的 accessibility tree 文本快照，含可交互元素 ref（如 @e1）。full=false 为紧凑视图；full=true 为完整内容。超过约 8000 字符会截断。browser_navigate 已含紧凑 snapshot，交互导致页面变化后可调用本工具刷新。",
          parameters: {
            type: "object",
            properties: {
              full: {
                type: "boolean",
                description: "true=完整页面；false=紧凑可交互元素视图",
                default: false,
              },
            },
            required: [],
          },
          handler: (args) => camofoxSnapshot(sessionKey(), Boolean(args.full)),
        },
        {
          name: "browser_click",
          description: "点击 snapshot 中 ref 标识的元素（如 @e5）。需先 browser_navigate。",
          parameters: {
            type: "object",
            properties: {
              ref: { type: "string", description: "snapshot 中的元素 ref，如 @e5" },
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
          description: "向 ref 对应输入框输入文本（先清空再输入）。需先 browser_navigate。",
          parameters: {
            type: "object",
            properties: {
              ref: { type: "string", description: "输入框 ref，如 @e3" },
              text: { type: "string", description: "要输入的文本" },
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
          description: "滚动页面（up/down）。需先 browser_navigate。",
          parameters: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["up", "down"], description: "滚动方向" },
            },
            required: ["direction"],
          },
          handler: (args) => camofoxScroll(sessionKey(), String(args.direction ?? "")),
        },
        {
          name: "browser_back",
          description: "浏览器后退。需先 browser_navigate。",
          parameters: { type: "object", properties: {}, required: [] },
          handler: () => camofoxBack(sessionKey()),
        },
        {
          name: "browser_press",
          description: "按下键盘键（Enter、Tab、Escape 等）。需先 browser_navigate。",
          parameters: {
            type: "object",
            properties: {
              key: { type: "string", description: "键名，如 Enter、Tab" },
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
            "读取浏览器 console 与 JS 错误。Camofox 后端仅返回空结果与说明；可用 browser_snapshot 检查页面。",
          parameters: {
            type: "object",
            properties: {
              clear: { type: "boolean", default: false, description: "读取后是否清空缓冲" },
            },
            required: [],
          },
          handler: (args) => camofoxConsole(sessionKey(), Boolean(args.clear)),
        },
        {
          name: "browser_get_images",
          description: "列出当前页面图片 URL 与 alt 文本。需先 browser_navigate。",
          parameters: { type: "object", properties: {}, required: [] },
          handler: () => camofoxGetImages(sessionKey()),
        },
        {
          name: "browser_vision",
          description:
            "截取当前页面 PNG 并保存到 ~/.anima/browser_screenshots/。annotate=true 时附加 accessibility tree 摘要。视觉 LLM 分析暂未接入，返回 screenshot_path。",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "希望从截图中了解的内容（供后续 vision 接入）",
              },
              annotate: {
                type: "boolean",
                default: false,
                description: "是否附加 snapshot 摘要作为标注上下文",
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
