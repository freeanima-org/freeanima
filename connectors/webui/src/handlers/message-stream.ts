import { logSseError } from "../api-logging.ts";
import { mapStreamEventToApi } from "../api-mappers.ts";
import { webuiCtx } from "./runtime.ts";
import { resolveSessionPlatform } from "./sessions.ts";

export async function* iterateMessageStream(
  sessionId: string,
  message: string,
  streamPath = "/api/sessions/messages/stream",
): AsyncGenerator<{ event: string; data: string }> {
  const { service } = webuiCtx();
  const platform = await resolveSessionPlatform(sessionId);
  let sawDone = false;
  try {
    for await (const event of service.sendMessageStream(sessionId, message, platform)) {
      const apiEvent = mapStreamEventToApi(event);
      if (apiEvent.event === "error") {
        logSseError(streamPath, apiEvent.data.error, { session_id: sessionId });
      }
      if (apiEvent.event === "done") sawDone = true;
      yield { event: apiEvent.event, data: JSON.stringify(apiEvent.data) };
    }
    if (!sawDone) {
      yield { event: "done", data: JSON.stringify({}) };
    }
  } catch (e) {
    logSseError(streamPath, e, { session_id: sessionId });
    yield { event: "error", data: JSON.stringify({ error: String(e) }) };
    yield { event: "done", data: JSON.stringify({}) };
  }
}
