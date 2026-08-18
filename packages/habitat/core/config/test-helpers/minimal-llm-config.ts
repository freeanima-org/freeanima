/** 集成 / 单测最小运行时：一条自定义文本连接 + 文本生成主场景 */
export const MINIMAL_LLM_YAML = `
connections:
  main:
    preset: custom
    custom_kind: text
    text_protocol: openai_compatible
    base_url: https://api.openai.com/v1
    api_key: test-key
text_generate:
  main:
    connection: main
    model: test-model
`;

export function minimalChatRuntime(opts?: {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  connectionId?: string;
}): {
  connections: Record<
    string,
    {
      preset: "custom";
      custom_kind: "text";
      text_protocol: "openai_compatible";
      base_url: string;
      api_key: string;
    }
  >;
  text_generate: { main: { connection: string; model: string } };
} {
  const id = opts?.connectionId ?? "main";
  return {
    connections: {
      [id]: {
        preset: "custom",
        custom_kind: "text",
        text_protocol: "openai_compatible",
        base_url: opts?.baseUrl ?? "https://api.openai.com/v1",
        api_key: opts?.apiKey ?? "test-key",
      },
    },
    text_generate: {
      main: { connection: id, model: opts?.model ?? "test-model" },
    },
  };
}
