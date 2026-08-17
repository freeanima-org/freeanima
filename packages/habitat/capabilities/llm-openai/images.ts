import { createOpenAiClientFromParsed } from "./client.ts";

export type GenerateImageInput = {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  timeoutMs?: number;
};

export type GenerateImageResult = {
  bytes: Uint8Array;
  mimeType: string;
  revisedPrompt?: string;
};

function decodeBase64(data: string): Uint8Array {
  return Uint8Array.from(Buffer.from(data, "base64"));
}

/** OpenAI-compatible POST …/images/generations → PNG/JPEG bytes */
export async function generateOpenAiImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const client = createOpenAiClientFromParsed({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl.replace(/\/$/, ""),
    ...(input.timeoutMs != null ? { timeoutMs: input.timeoutMs } : {}),
  });

  const payload: {
    model: string;
    prompt: string;
    n: number;
    response_format: "b64_json";
    size?: string;
    quality?: string;
  } = {
    model: input.model,
    prompt: input.prompt,
    n: 1,
    response_format: "b64_json",
  };
  const sizeHint = input.size?.trim();
  if (sizeHint) payload.size = sizeHint;
  const qualityHint = input.quality?.trim();
  if (qualityHint) payload.quality = qualityHint;
  const res = await client.images.generate(payload as never);

  const item = res.data?.[0];
  const b64 = item?.b64_json;
  if (!b64) {
    throw new Error("文生图未返回图像数据");
  }

  return {
    bytes: decodeBase64(b64),
    mimeType: "image/png",
    ...(item.revised_prompt ? { revisedPrompt: item.revised_prompt } : {}),
  };
}
