/** HuggingFace / Ollama 探测超时；避免启动在不可达 Hub 上无限挂起。 */
export const TOKENIZER_FETCH_TIMEOUT_MS = 5_000;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = TOKENIZER_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...init, signal });
}
