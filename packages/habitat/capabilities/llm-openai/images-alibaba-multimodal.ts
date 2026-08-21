import type { GenerateImageInput, GenerateImageResult } from "./images.ts";
import { asRecord } from "@freeanima/shared/util";

/** OpenAI 兼容根 → 多模态 generation URL（Token Plan / 百炼） */
export function alibabaMultimodalGenerationUrl(openaiCompatibleBaseUrl: string): string {
  const trimmed = openaiCompatibleBaseUrl.trim().replace(/\/$/, "");
  let origin: string;
  try {
    origin = new URL(trimmed).origin;
  } catch {
    throw new Error(`无效的 Base URL: ${openaiCompatibleBaseUrl}`);
  }
  return `${origin}/api/v1/services/aigc/multimodal-generation/generation`;
}

/** OpenAI `1024x1024` → 百炼 `1024*1024`；已是 `*`/`1K`/`2K` 则原样 */
export function normalizeAlibabaImageSize(size: string | undefined): string | undefined {
  const s = size?.trim();
  if (!s) return undefined;
  if (/^\d+[xX]\d+$/.test(s)) return s.replace(/[xX]/, "*");
  return s;
}

function extractImageUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { output?: { choices?: unknown } }).output?.choices;
  if (!Array.isArray(choices)) return null;
  for (const choice of choices) {
    const choiceRec = asRecord(choice);
    if (!choiceRec) continue;
    const content = asRecord(choiceRec.message)?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const partRec = asRecord(part);
      if (!partRec) continue;
      const image = partRec.image;
      if (typeof image === "string" && image.trim()) return image.trim();
    }
  }
  return null;
}

function guessMimeFromUrl(url: string): string {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}

/**
 * 阿里云 Token Plan / 百炼多模态文生图（wan2.7-image、qwen-image-* 等）。
 * 不走 OpenAI `/images/generations`。
 */
export async function generateAlibabaMultimodalImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const url = alibabaMultimodalGenerationUrl(input.baseUrl);
  const size = normalizeAlibabaImageSize(input.size);
  const body: Record<string, unknown> = {
    model: input.model,
    input: {
      messages: [
        {
          role: "user",
          content: [{ text: input.prompt }],
        },
      ],
    },
    parameters: {
      n: 1,
      ...(size ? { size } : {}),
    },
  };

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object"
        ? JSON.stringify(parsed).slice(0, 500)
        : text.slice(0, 500) || "(no body)";
    throw new Error(`文生图失败 HTTP ${res.status}: ${detail}`);
  }

  const imageUrl = extractImageUrl(parsed);
  if (!imageUrl) {
    throw new Error(`文生图未返回图像 URL: ${text.slice(0, 400) || "(empty)"}`);
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`下载生成图失败 HTTP ${imgRes.status}`);
  }
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("下载生成图为空");
  }

  return {
    bytes,
    mimeType:
      imgRes.headers.get("content-type")?.split(";")[0]?.trim() || guessMimeFromUrl(imageUrl),
  };
}
