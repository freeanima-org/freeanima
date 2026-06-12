import type { ClarifyItem } from "@freeanima/storage-db/domain";

export type ClarifyPayload = {
  items: ClarifyItem[];
  timeout_sec: number;
};

export type ClarifyAdapter = {
  platform: string;
  format(payload: ClarifyPayload): string;
};

export type ClarifyWebUiPayload = ClarifyPayload & {
  formatted: string;
};
