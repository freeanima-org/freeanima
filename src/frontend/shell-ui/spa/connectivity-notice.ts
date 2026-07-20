import type { HabitatConnectionState } from "@freeanima/frontend/shell-sdk/react.tsx";

export type ConnectivityNoticeVariant = "info" | "warning";

export type ConnectivityNotice = {
  variant: ConnectivityNoticeVariant;
  kind: "offline" | "hub-connecting" | "hub-disconnected";
};

export function resolveConnectivityNotice(input: {
  networkOnline: boolean;
  habitatConnection: HabitatConnectionState;
}): ConnectivityNotice | null {
  if (!input.networkOnline) {
    return { variant: "warning", kind: "offline" };
  }
  if (input.habitatConnection === "connecting") {
    return { variant: "info", kind: "hub-connecting" };
  }
  if (input.habitatConnection === "disconnected") {
    return { variant: "warning", kind: "hub-disconnected" };
  }
  return null;
}

export function shellWritesDisabled(input: {
  networkOnline: boolean;
  habitatConnection: HabitatConnectionState;
}): boolean {
  return !input.networkOnline || input.habitatConnection !== "connected";
}
