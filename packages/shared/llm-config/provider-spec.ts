/** Provider 规格（presets → core/provider 的契约；context 为不透明数据）。 */
export type ProviderSpec = {
  id: string;
  /**
   * Default Format id (`LlmBackend.id`).
   * Single-format connections use this always; gateway presets use it for
   * catalog/listModels and as fallback when `resolveFormat` is absent.
   */
  backendId: string;
  context: Record<string, unknown>;
  /** Gateway presets: choose Format by model id */
  resolveFormat?: (model: string) => string;
};
