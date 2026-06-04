import { describe, it, expect } from "bun:test";
import {
  MSG_TYPE_USER,
  ITEM_TEXT,
  MSG_TYPE_BOT,
  buildWeixinOrigin,
  explainInboundSkip,
  extractTextFromMessage,
  normalizeInboundMessage,
  parseUserTextMessage,
} from "@freeanima/legacy-gateway";

describe("weixin-message", () => {
  it("extracts text from item_list", () => {
    const text = extractTextFromMessage({
      item_list: [{ type: ITEM_TEXT, text_item: { text: "你好" } }],
    });
    expect(text).toBe("你好");
  });

  it("does not filter by linked human user_id (only bot account_id)", () => {
    const human = "test-user@im.wechat";
    const bot = "test-bot@im.bot";
    const parsed = parseUserTextMessage(
      {
        from_user_id: human,
        item_list: [{ type: ITEM_TEXT, text_item: { text: "你好" } }],
      },
      bot,
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe("你好");
    expect(
      parseUserTextMessage(
        {
          from_user_id: human,
          item_list: [{ type: ITEM_TEXT, text_item: { text: "x" } }],
        },
        human,
      ),
    ).toBeNull();
  });

  it("parses user DM message", () => {
    const parsed = parseUserTextMessage(
      {
        message_type: MSG_TYPE_USER,
        from_user_id: "user-1",
        item_list: [{ type: ITEM_TEXT, text_item: { text: "hi" } }],
        msg_id: "m1",
      },
      "bot-account@im.bot",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.peerId).toBe("user-1");
    expect(parsed!.isGroup).toBe(false);
    expect(parsed!.text).toBe("hi");
  });

  it("parses group message with room_id", () => {
    const parsed = parseUserTextMessage(
      {
        message_type: MSG_TYPE_USER,
        from_user_id: "user-1",
        room_id: "room-9",
        item_list: [{ type: ITEM_TEXT, text_item: { text: "群消息" } }],
      },
      "",
    );
    expect(parsed!.isGroup).toBe(true);
    expect(parsed!.peerId).toBe("room-9");
  });

  it("parses message without message_type (Hermes/iLink 常见)", () => {
    const parsed = parseUserTextMessage(
      {
        from_user_id: "wxid_user1",
        item_list: [{ type: ITEM_TEXT, text_item: { text: "hello" } }],
        message_id: "msg-1",
      },
      "bot-self",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe("hello");
    expect(parsed!.msgId).toBe("msg-1");
  });

  it("skips bot message_type", () => {
    const parsed = parseUserTextMessage(
      {
        message_type: MSG_TYPE_BOT,
        from_user_id: "wxid_user1",
        item_list: [{ type: ITEM_TEXT, text_item: { text: "echo" } }],
      },
      "",
    );
    expect(parsed).toBeNull();
  });

  it("explainInboundSkip 给出跳过原因", () => {
    expect(
      explainInboundSkip(
        {
          message_type: MSG_TYPE_BOT,
          from_user_id: "u1",
          item_list: [{ type: ITEM_TEXT, text_item: { text: "x" } }],
        },
        "bot@im.bot",
      ),
    ).toBe("message_type is BOT");
    expect(explainInboundSkip({ from_user_id: "bot@im.bot", item_list: [] }, "bot@im.bot")).toBe(
      "from_user_id matches bot account_id",
    );
    expect(explainInboundSkip({ from_user_id: "u1", item_list: [] }, "")).toBe(
      "no extractable text in item_list",
    );
  });

  it("unwraps nested msg and camelCase fields", () => {
    const normalized = normalizeInboundMessage({
      msg: {
        fromUserId: "u2",
        itemList: [{ type: "1", textItem: { text: "嗨" } }],
        messageId: "m2",
      },
    });
    expect(normalized.from_user_id).toBe("u2");
    const parsed = parseUserTextMessage(normalized, "");
    expect(parsed!.text).toBe("嗨");
    expect(parsed!.msgId).toBe("m2");
  });

  it("extracts voice transcript text", () => {
    const text = extractTextFromMessage({
      item_list: [{ type: 2, voice_item: { text: "语音转文字" } }],
    });
    expect(text).toBe("语音转文字");
  });

  it("buildWeixinOrigin for session routing", () => {
    const parsed = parseUserTextMessage(
      {
        message_type: MSG_TYPE_USER,
        from_user_id: "u1",
        item_list: [{ type: ITEM_TEXT, text_item: { text: "x" } }],
      },
      "",
    )!;
    const o = buildWeixinOrigin(parsed);
    expect(o.platform).toBe("weixin");
    expect(o.platform_extra.weixin_peer_id).toBe("u1");
    expect(o.platform_extra.is_group).toBe(false);
  });
});
