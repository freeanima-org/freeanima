import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import {
  IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
  IMAGE_PROTOCOL_OPENAI,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  resolveScene,
} from "@freeanima/habitat/core/config";
import { materializeConnection } from "@freeanima/habitat/core/llm/presets";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/habitat/core/db/pg/entity";
import type { SubjectKind } from "@freeanima/habitat/core/config";
import {
  attachToolReturns,
  defineToolReturn,
  toolError,
  toolResult,
  type ToolArgs,
  z,
} from "@freeanima/habitat/core/tool";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { createObjectFile } from "@freeanima/features/object-storage/domain";
import { generateOpenAiImage } from "@freeanima/habitat/capabilities/llm-openai/images";
import { generateAlibabaMultimodalImage } from "@freeanima/habitat/capabilities/llm-openai/images-alibaba-multimodal";
import { synthesizeVoiceFromScene } from "@freeanima/habitat/capabilities/llm-openai/voice-synthesize";
import { readVoiceProsodyParams } from "@freeanima/habitat/core/tts/voice-params";
import {
  formatVoiceIdsForToolHint,
  OPENAI_AUDIO_VOICE_OPTIONS,
} from "@freeanima/habitat/core/tts/voice-catalog";
import {
  VOICE_PROTOCOL_ALIBABA_AUDIO,
  VOICE_PROTOCOL_EDGE_TTS,
} from "@freeanima/habitat/core/config/schemas/llm-config";
import { coerceString } from "@freeanima/shared/coerce-string";

function voiceGenerateToolVoiceDescription(): string {
  const edge = formatVoiceIdsForToolHint(VOICE_PROTOCOL_EDGE_TTS);
  const oai = OPENAI_AUDIO_VOICE_OPTIONS.map((v) => v.id).join(", ");
  const ali = formatVoiceIdsForToolHint(VOICE_PROTOCOL_ALIBABA_AUDIO, "qwen-audio-3.0-tts-plus");
  return [
    "Voice / timbre id. Edge: often same as scene model (e.g. zh-CN-XiaoxiaoNeural).",
    `OpenAI examples: ${oai}.`,
    `Alibaba (qwen-audio-3.0-tts-plus) examples: ${ali}. Required for Alibaba if scene.params.voice unset — missing voice causes CosyVoice 411.`,
    edge ? `Edge examples: ${edge}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const MEDIA_TOOL_RETURNS = {
  image_generate: defineToolReturn({
    schema: z.object({
      object_file_id: z.number().int().positive(),
      title: z.string(),
      mime_type: z.string(),
      size: z.number().int().nonnegative(),
      revised_prompt: z.string().optional(),
    }),
    example: {
      object_file_id: 42,
      title: "cat.png",
      mime_type: "image/png",
      size: 1024,
    },
  }),
  voice_generate: defineToolReturn({
    schema: z.object({
      object_file_id: z.number().int().positive(),
      title: z.string(),
      mime_type: z.string(),
      size: z.number().int().nonnegative(),
    }),
    example: {
      object_file_id: 43,
      title: "speech.mp3",
      mime_type: "audio/mpeg",
      size: 2048,
    },
  }),
};

async function resolveWorld(args: ToolArgs): Promise<number | string> {
  try {
    const explicit =
      typeof args.world_id === "number"
        ? args.world_id
        : typeof args.world_id === "string" && args.world_id.trim()
          ? Number(args.world_id)
          : undefined;
    const rawSubject = args.subject_kind;
    const subject: SubjectKind | undefined =
      rawSubject === "user" || rawSubject === "agent" ? rawSubject : undefined;
    if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
      return await resolveToolWorld({ explicitWorldId: explicit, access: "write" });
    }
    if (subject == null) {
      return toolError("subject_kind is required (user|agent) when world_id omitted");
    }
    return await resolveToolWorld({ subjectKind: subject, access: "write" });
  } catch (err) {
    if (err instanceof ToolWorldAccessError) return toolError(err.message);
    throw err;
  }
}

export function registerMediaTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "media",
    "Media generation (image + voice). Requires scenes.image_generate / voice_generate and matching connection protocols.",
    attachToolReturns(
      [
        {
          name: "image_generate",
          description:
            "Generate an image from a text prompt via the configured image_generate scene. Saves to object storage and returns object_file_id.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Image generation prompt" },
              size: {
                type: "string",
                description: "Optional size (e.g. 1024x1024), overrides scene params",
              },
              quality: {
                type: "string",
                description: "Optional quality hint for the provider",
              },
              title: {
                type: "string",
                description: "Optional object_file title; defaults from prompt",
              },
              world_id: {
                type: "integer",
                description: "Optional world override",
              },
              subject_kind: {
                type: "string",
                enum: ["user", "agent"],
                description: "Owning subject when world_id omitted",
              },
            },
            required: ["prompt"],
          },
          handler: async (args: ToolArgs) => {
            const prompt = coerceString(args.prompt ?? "").trim();
            if (!prompt) return toolError("prompt is required");

            let scene;
            try {
              scene = resolveScene(getActiveRuntimeConfig().data, "image_generate");
            } catch (err) {
              return toolError(
                err instanceof Error
                  ? err.message
                  : "未配置图片生成场景（llm.scenes.image_generate）",
              );
            }

            const preset = coerceString(scene.provider.preset ?? "");
            const useAlibabaMultimodal =
              scene.imageProtocol === IMAGE_PROTOCOL_ALIBABA_MULTIMODAL ||
              preset === LLM_PRESET_ALIBABA_TOKEN_PLAN;
            const useOpenAiImages =
              scene.imageProtocol === IMAGE_PROTOCOL_OPENAI && !useAlibabaMultimodal;

            if (!useAlibabaMultimodal && !useOpenAiImages) {
              return toolError(
                scene.imageProtocol == null
                  ? "该连接未配置文生图协议（image_protocol）"
                  : `不支持的文生图协议: ${scene.imageProtocol}`,
              );
            }

            let baseUrl: string;
            try {
              baseUrl = materializeConnection(scene.provider).baseUrl;
            } catch (err) {
              return toolError(err instanceof Error ? err.message : "图片生成连接 Base URL 无效");
            }
            const apiKey = scene.provider.api_key?.trim();
            if (!apiKey) {
              return toolError("图片生成连接缺少 api_key");
            }

            const size =
              coerceString(args.size ?? "").trim() ||
              coerceString(scene.params?.size ?? "").trim() ||
              undefined;
            const quality =
              coerceString(args.quality ?? "").trim() ||
              coerceString(scene.params?.quality ?? "").trim() ||
              undefined;

            let generated;
            try {
              const common = {
                apiKey,
                baseUrl,
                model: scene.model,
                prompt,
                ...(size ? { size } : {}),
                ...(scene.provider.timeout_ms != null
                  ? { timeoutMs: scene.provider.timeout_ms }
                  : {}),
              };
              generated = useAlibabaMultimodal
                ? await generateAlibabaMultimodalImage(common)
                : await generateOpenAiImage({
                    ...common,
                    ...(quality ? { quality } : {}),
                  });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : "文生图失败");
            }

            const world = await resolveWorld(args);
            if (typeof world === "string") return world;

            const title =
              coerceString(args.title ?? "").trim() || `generated-${Date.now()}.png`.slice(0, 80);

            try {
              const file = await createObjectFile({
                world_id: world,
                title,
                bytes: generated.bytes,
                mime_type: generated.mimeType,
              });
              return toolResult({
                object_file_id: file.id,
                title: file.title,
                mime_type: file.mime_type,
                size: file.size,
                ...(generated.revisedPrompt ? { revised_prompt: generated.revisedPrompt } : {}),
              });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : "保存生成图失败");
            }
          },
        },
        {
          name: "voice_generate",
          description:
            "Synthesize speech from text via the configured voice_generate scene. Saves to object storage and returns object_file_id. Prefer scene params.voice; pass voice when overriding or when Alibaba scene has no default timbre.",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "Text to synthesize" },
              voice: { type: "string", description: voiceGenerateToolVoiceDescription() },
              rate: { type: "number", description: "Relative speaking rate (1.0 = default)" },
              pitch: { type: "number", description: "Relative pitch (1.0 = default)" },
              volume: { type: "number", description: "Relative volume (1.0 = default)" },
              title: {
                type: "string",
                description: "Optional object_file title; defaults from text",
              },
              world_id: {
                type: "integer",
                description: "Optional world override",
              },
              subject_kind: {
                type: "string",
                enum: ["user", "agent"],
                description: "Owning subject when world_id omitted",
              },
            },
            required: ["text"],
          },
          handler: async (args: ToolArgs) => {
            const text = coerceString(args.text ?? "").trim();
            if (!text) return toolError("text is required");

            const override = readVoiceProsodyParams({
              voice: args.voice,
              rate: args.rate,
              pitch: args.pitch,
              volume: args.volume,
            });

            const generated = await synthesizeVoiceFromScene({
              text,
              purpose: "voice_generate",
              prosody: override,
            });
            if ("error" in generated) return toolError(generated.error);

            const world = await resolveWorld(args);
            if (typeof world === "string") return world;

            const ext = generated.mimeType.includes("wav")
              ? "wav"
              : generated.mimeType.includes("pcm")
                ? "pcm"
                : "mp3";
            const title =
              coerceString(args.title ?? "").trim() || `speech-${Date.now()}.${ext}`.slice(0, 80);

            try {
              const file = await createObjectFile({
                world_id: world,
                title,
                bytes: generated.bytes,
                mime_type: generated.mimeType,
              });
              return toolResult({
                object_file_id: file.id,
                title: file.title,
                mime_type: file.mime_type,
                size: file.size,
              });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : "保存生成音频失败");
            }
          },
        },
      ],
      MEDIA_TOOL_RETURNS,
    ),
  );
}
