import type { HabitatConnectionState } from "@freeanima/client/portal-sdk/react.tsx";

export type ConnectivityNoticeVariant = "info" | "warning";

export type ConnectivityNotice = {
  variant: ConnectivityNoticeVariant;
  kind: "offline" | "local-prefer" | "habitat-connecting" | "habitat-disconnected";
};

export function resolveConnectivityNotice(input: {
  networkOnline: boolean;
  habitatConnection: HabitatConnectionState;
  localPrefer?: boolean;
}): ConnectivityNotice | null {
  if (!input.networkOnline) {
    return { variant: "warning", kind: "offline" };
  }
  if (input.habitatConnection === "connecting") {
    return { variant: "info", kind: "habitat-connecting" };
  }
  if (input.habitatConnection === "disconnected") {
    return { variant: "warning", kind: "habitat-disconnected" };
  }
  if (input.localPrefer) {
    return { variant: "warning", kind: "local-prefer" };
  }
  return null;
}

export function shellWritesDisabled(input: {
  networkOnline: boolean;
  habitatConnection: HabitatConnectionState;
}): boolean {
  return !input.networkOnline || input.habitatConnection !== "connected";
}
