import type { HubConnectionState } from "@freeanima/shell-sdk/react";

export type ConnectivityNoticeVariant = "info" | "warning";

export type ConnectivityNotice = {
  variant: ConnectivityNoticeVariant;
  kind: "offline" | "hub-connecting" | "hub-disconnected";
};

export function resolveConnectivityNotice(input: {
  networkOnline: boolean;
  hubConnection: HubConnectionState;
}): ConnectivityNotice | null {
  if (!input.networkOnline) {
    return { variant: "warning", kind: "offline" };
  }
  if (input.hubConnection === "connecting") {
    return { variant: "info", kind: "hub-connecting" };
  }
  if (input.hubConnection === "disconnected") {
    return { variant: "warning", kind: "hub-disconnected" };
  }
  return null;
}

export function shellWritesDisabled(input: {
  networkOnline: boolean;
  hubConnection: HubConnectionState;
}): boolean {
  return !input.networkOnline || input.hubConnection !== "connected";
}
