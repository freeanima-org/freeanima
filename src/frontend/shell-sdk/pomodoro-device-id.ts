/// <reference lib="dom" />

const DEVICE_KEY = "freeanima.pomodoro.device_id";

export function getPomodoroDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)?.trim();
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "unknown-device";
  }
}

export function clearPomodoroDeviceIdForTest(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DEVICE_KEY);
}
