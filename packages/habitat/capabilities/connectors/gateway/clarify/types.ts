import type { ClarifyItem } from "@freeanima/habitat/core/db/domain";

export type ClarifyPayload = {
  items: ClarifyItem[];
  timeout_sec: number;
};

export type ClarifyAdapter = {
  platform: string;
  format(payload: ClarifyPayload): string;
};

export type ClarifyChatUiPayload = ClarifyPayload & {
  formatted: string;
};
