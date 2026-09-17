const PROJECT_PARAM = "project";

export function readProjectFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(PROJECT_PARAM)?.trim();
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function writeProjectToUrl(projectId: number | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(PROJECT_PARAM);
  if (projectId != null) {
    url.searchParams.set(PROJECT_PARAM, String(projectId));
  }
  window.history.replaceState(null, "", url);
}
