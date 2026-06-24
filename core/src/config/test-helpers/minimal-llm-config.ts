/** Minimal remote_auth block for unit tests */
export const MINIMAL_REMOTE_AUTH = {
  token: "test-remote-auth-token-min16",
} as const;
export const MINIMAL_LLM_YAML = `
llm:
  default_profile: chat
  providers:
    main:
      backend: openai_compatible
      base_url: https://api.openai.com/v1
      api_key: test-key
  profiles:
    chat:
      chain:
        - provider: main
          model: test-model
    reflect:
      chain:
        - provider: main
          model: test-model
    summary:
      chain:
        - provider: main
          model: test-model
remote_auth:
  token: test-remote-auth-token-min16
`;
