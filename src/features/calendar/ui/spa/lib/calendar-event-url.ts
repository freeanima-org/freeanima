const EVENT_PARAM = "event";

export function readCalendarEventFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(EVENT_PARAM)?.trim();
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function writeCalendarEventToUrl(eventId: number | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(EVENT_PARAM);
  if (eventId != null) {
    url.searchParams.set(EVENT_PARAM, String(eventId));
  }
  window.history.replaceState(null, "", url);
}
