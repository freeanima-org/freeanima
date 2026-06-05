import { SteppedBackoff } from "@freeanima/kernel-retry";
import { safeParseOrNull, PATHS, logComponent } from "@freeanima/legacy-kernel";
import type { NestService } from "@freeanima/legacy-runtime";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import type { PlatformAdapter } from "../platforms.ts";
import { collectGatewayStreamReply } from "../collect-gateway-stream-reply.ts";
import { registerWeixinCronDeliverer, unregisterWeixinCronDeliverer } from "../cron-deliver.ts";
import { MAX_CONSECUTIVE_FAILURES, getUpdates, sendText } from "./ilink-api.ts";
import {
  buildWeixinOrigin,
  explainInboundSkip,
  normalizeInboundMessage,
  parseUserTextMessage,
} from "./weixin-message.ts";
import type { WeixinCredentials } from "./weixin-credentials.ts";
import {
  weixinContextTokensSchema,
  weixinSyncSchema,
  ilinkMessageSchema,
} from "../schemas/weixin.ts";

function safeId(value: string | undefined, keep = 8): string {
  const raw = (value ?? "").trim();
  if (!raw || raw.length <= keep) return raw || "?";
  return raw.slice(0, keep);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export class WeixinAdapter implements PlatformAdapter {
  readonly name = "weixin";

  private syncBuf = "";
  private contextTokens: Record<string, string> = {};
  private readonly seen = new Set<string>();
  private failures = 0;
  private readonly pollBackoff = new SteppedBackoff();
  private readonly clientId: string;
  private abort: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly service: NestService,
    private readonly creds: WeixinCredentials,
  ) {
    this.clientId = `anima-${randomBytes(4).toString("hex")}`;
    this.restoreState();
  }

  async start(): Promise<void> {
    this.service.registerPlatform("weixin");
    this.service.updatePlatformStatus("weixin", "starting");
    this.abort = new AbortController();
    this.loopPromise = this.runLoop(this.abort.signal);
    void this.loopPromise.catch((e) => {
      if (this.abort?.signal.aborted) return;
      logComponent("weixin").error("WeChat adapter loop exited", { err: e });
    });
  }

  async stop(): Promise<void> {
    logComponent("shutdown").debug("微信 adapter 中止轮询…");
    unregisterWeixinCronDeliverer();
    this.abort?.abort();
    const loop = this.loopPromise;
    if (loop) {
      try {
        await Promise.race([loop, new Promise<void>((r) => setTimeout(r, 5000))]);
      } catch {
        /* aborted */
      }
    }
    this.persistState();
    this.abort = null;
    this.loopPromise = null;
    logComponent("shutdown").debug("微信 adapter 已停止");
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    logComponent("weixin").info(
      `WeChat adapter started (account=${safeId(this.creds.account_id)} linked_user=${safeId(this.creds.user_id)})`,
      {
        account_id: safeId(this.creds.account_id),
        linked_user_id: safeId(this.creds.user_id),
      },
    );
    this.service.updatePlatformStatus("weixin", "connected", {
      account_id: safeId(this.creds.account_id),
      linked_user_id: safeId(this.creds.user_id),
    });
    registerWeixinCronDeliverer({
      baseUrl: this.creds.base_url,
      token: this.creds.token,
      clientId: this.clientId,
      contextTokens: this.contextTokens,
    });

    while (!signal.aborted) {
      try {
        await this.pollOnce(signal);
        this.failures = 0;
        this.pollBackoff.reset();
      } catch (e) {
        if (signal.aborted) break;
        this.failures += 1;
        const delay = this.pollBackoff.nextDelayMs();
        logComponent("weixin").warn(
          `WeChat poll error (attempt ${this.failures}/${MAX_CONSECUTIVE_FAILURES})`,
          {
            attempt: this.failures,
            max_attempts: MAX_CONSECUTIVE_FAILURES,
            delay_ms: delay,
            err: e,
          },
        );
        if (this.failures >= MAX_CONSECUTIVE_FAILURES) {
          logComponent("weixin").error("WeChat poll error", {
            err: e,
            failures: this.failures,
          });
          this.service.updatePlatformStatus("weixin", "backoff", { delay_ms: delay });
        }
        try {
          await sleep(delay, signal);
        } catch {
          break;
        }
      }
    }
  }

  private async pollOnce(signal: AbortSignal): Promise<void> {
    const resp = await getUpdates(this.creds.base_url, this.creds.token, this.syncBuf, signal);

    const newBuf = String(resp.get_updates_buf ?? "");
    if (newBuf) {
      this.syncBuf = newBuf;
      this.persistSyncBuf();
    }

    const msgs = resp.msgs;
    if (!Array.isArray(msgs)) return;

    if (msgs.length > 0) {
      logComponent("weixin").info(`WeChat poll received ${msgs.length} message(s)`, {
        count: msgs.length,
      });
    }

    let routed = 0;
    let skipped = 0;

    for (const raw of msgs) {
      const inbound = safeParseOrNull(ilinkMessageSchema, raw);
      if (!inbound) {
        skipped += 1;
        logComponent("weixin").warn("WeChat inbound skipped: schema parse failed");
        continue;
      }
      const msg = normalizeInboundMessage(inbound);
      const msgId = String(msg.msg_id ?? msg.message_id ?? msg.seq_id ?? "");
      if (msgId && this.seen.has(msgId)) continue;

      if (msgId) {
        this.seen.add(msgId);
        if (this.seen.size > 1000) this.seen.clear();
      }

      const parsed = parseUserTextMessage(msg, this.creds.account_id);
      if (!parsed) {
        skipped += 1;
        const reason = explainInboundSkip(msg, this.creds.account_id);
        logComponent("weixin").warn(`WeChat inbound skipped: ${reason}`, {
          reason,
          from_user_id: safeId(String(msg.from_user_id ?? "")),
          message_type: msg.message_type ?? null,
        });
        continue;
      }

      routed += 1;

      if (process.env.DEBUG?.includes("weixin")) {
        logComponent("weixin").info(
          `WeChat inbound from ${safeId(parsed.fromUserId)}: ${parsed.text.slice(0, 60)}`,
          { from_user_id: safeId(parsed.fromUserId) },
        );
      } else {
        logComponent("weixin").info(
          `WeChat inbound from ${safeId(parsed.fromUserId)}: ${parsed.text.slice(0, 60)}`,
          { from_user_id: safeId(parsed.fromUserId), peer_id: safeId(parsed.peerId) },
        );
      }

      if (parsed.contextToken) {
        this.contextTokens[parsed.peerId] = parsed.contextToken;
      }

      void this.routeToRuntime(parsed).catch((e) => {
        logComponent("weixin").error("WeChat message routing error", { err: e });
      });
    }

    if (msgs.length > 0 && routed === 0 && skipped > 0) {
      logComponent("weixin").warn("WeChat poll batch had no routable messages", {
        total: msgs.length,
        skipped,
      });
    }
  }

  private async routeToRuntime(
    parsed: NonNullable<ReturnType<typeof parseUserTextMessage>>,
  ): Promise<void> {
    const origin = buildWeixinOrigin(parsed);
    let sid = "";

    try {
      const session = await this.service.findOrCreateSession("weixin", origin.platform_extra);
      sid = session.session_id;

      const cmdResult = await this.service.executeCommand({
        session_id: sid,
        text: parsed.text,
        platform: "weixin",
        origin_extra: origin.platform_extra,
      });

      if (cmdResult.found) {
        if (cmdResult.text) await this.sendReply(parsed.peerId, cmdResult.text);
        return;
      }

      const reply = await collectGatewayStreamReply(
        this.service.sendMessageStream(sid, parsed.text, "weixin"),
      );
      if (reply) await this.sendReply(parsed.peerId, reply);
    } catch (e) {
      logComponent("weixin").error(`WeChat session ${safeId(sid)} routing error`, {
        err: e,
        session_id: sid || undefined,
      });
      await this.sendReply(parsed.peerId, "⚠️ 引擎出错，请稍后再试");
    }
  }

  private async sendReply(peerId: string, text: string): Promise<void> {
    const contextToken = this.contextTokens[peerId];
    try {
      const result = await sendText(
        this.creds.base_url,
        this.creds.token,
        peerId,
        text,
        this.clientId,
        contextToken,
      );
      if (process.env.DEBUG?.includes("weixin")) {
        logComponent("weixin").info(`WeChat reply sent to ${safeId(peerId)}`, {
          peer_id: safeId(peerId),
          ret: String(result.ret ?? "?"),
        });
      }
    } catch (e) {
      logComponent("weixin").error("WeChat send reply failed", { err: e });
    }
  }

  private restoreState(): void {
    try {
      if (existsSync(PATHS.weixinSyncFile)) {
        const raw: unknown = JSON.parse(readFileSync(PATHS.weixinSyncFile, "utf-8"));
        const data = safeParseOrNull(weixinSyncSchema, raw);
        this.syncBuf = data?.sync_buf ?? "";
      }
    } catch {
      /* no state */
    }

    try {
      if (existsSync(PATHS.weixinContextTokensFile)) {
        const raw: unknown = JSON.parse(readFileSync(PATHS.weixinContextTokensFile, "utf-8"));
        this.contextTokens = safeParseOrNull(weixinContextTokensSchema, raw) ?? {};
      }
    } catch {
      this.contextTokens = {};
    }
  }

  private persistSyncBuf(): void {
    try {
      mkdirSync(PATHS.weixinDir, { recursive: true });
      writeFileSync(
        PATHS.weixinSyncFile,
        JSON.stringify({ sync_buf: this.syncBuf }, null, 0),
        "utf-8",
      );
    } catch (e) {
      logComponent("weixin").error("WeChat: failed to persist sync buffer", { err: e });
    }
  }

  private persistContextTokens(): void {
    try {
      mkdirSync(PATHS.weixinDir, { recursive: true });
      writeFileSync(
        PATHS.weixinContextTokensFile,
        JSON.stringify(this.contextTokens, null, 0),
        "utf-8",
      );
    } catch (e) {
      logComponent("weixin").error("WeChat: failed to persist context tokens", { err: e });
    }
  }

  private persistState(): void {
    this.persistSyncBuf();
    this.persistContextTokens();
  }
}

export function createWeixinAdapter(service: NestService, creds: WeixinCredentials): WeixinAdapter {
  return new WeixinAdapter(service, creds);
}
