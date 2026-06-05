export { weixinContextTokensSchema, weixinSyncSchema } from "@freeanima/kernel-schemas/weixin";
import { z } from "zod";

export const ilinkMessageSchema = z.record(z.string(), z.unknown());

export type IlinkMessage = z.infer<typeof ilinkMessageSchema>;
