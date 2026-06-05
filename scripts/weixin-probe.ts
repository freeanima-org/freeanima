#!/usr/bin/env bun
/** 微信 iLink 探活：getupdates 一次，打印 ret / msgs 数量 / 首条摘要（需 pass services/weixin-ilink） */
import { existsSync, readFileSync } from "node:fs";

import { PATHS } from "@freeanima/service-config";
import { getUpdates } from "../packages/gateway/src/weixin/ilink-api.ts";
import { loadWeixinCredentials } from "../packages/gateway/src/weixin/weixin-credentials.ts";
import {
  explainInboundSkip,
  normalizeInboundMessage,
  parseUserTextMessage,
} from "../packages/gateway/src/weixin/weixin-message.ts";

const creds = loadWeixinCredentials();
if (!creds) {
  console.error("未找到微信凭证（pass services/weixin-ilink 或 ~/.hermes/weixin/accounts）");
  process.exit(1);
}

let syncBuf = "";
if (existsSync(PATHS.weixinSyncFile)) {
  try {
    const raw = JSON.parse(readFileSync(PATHS.weixinSyncFile, "utf-8")) as {
      sync_buf?: string;
    };
    syncBuf = raw.sync_buf ?? "";
  } catch {
    /* ignore */
  }
}

console.log("base_url:", creds.base_url);
console.log("account_id:", creds.account_id);
console.log("sync_buf length:", syncBuf.length);

const resp = await getUpdates(creds.base_url, creds.token, syncBuf);
console.log("ret:", resp.ret, "errcode:", resp.errcode ?? 0);
const msgs = resp.msgs;
const count = Array.isArray(msgs) ? msgs.length : 0;
console.log("msgs:", count);
console.log("new sync_buf length:", String(resp.get_updates_buf ?? syncBuf).length);

if (Array.isArray(msgs) && msgs.length > 0) {
  const first = normalizeInboundMessage(msgs[0] as never);
  const parsed = parseUserTextMessage(first, creds.account_id);
  if (parsed) {
    console.log("first routable:", {
      from: parsed.fromUserId,
      peer: parsed.peerId,
      text: parsed.text.slice(0, 80),
    });
  } else {
    console.log("first skipped:", explainInboundSkip(first, creds.account_id));
  }
}
