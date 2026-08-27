/** 向 tab 内各 frame 广播消息（跨域 iframe 登录框填充）。 */

export type TabFrameDetails = { frameId: number };

export type TabFramesWebNavigation = {
  getAllFrames: (details: { tabId: number }) => Promise<TabFrameDetails[] | null>;
};

export type TabFramesTabs = {
  sendMessage: (
    tabId: number,
    message: unknown,
    options?: { frameId?: number },
  ) => Promise<unknown>;
};

export type SendTabMessageAllFramesDeps = {
  webNavigation?: TabFramesWebNavigation;
  tabs?: TabFramesTabs;
};

async function listFrames(
  tabId: number,
  webNavigation: TabFramesWebNavigation,
): Promise<TabFrameDetails[] | null> {
  try {
    return await webNavigation.getAllFrames({ tabId });
  } catch {
    return null;
  }
}

/**
 * 向 tab 的每个 frame 发送同一消息；无 frames 时回退顶层一次。
 * 忽略无 content script / 不可达 frame 的错误。
 */
export async function sendTabMessageAllFrames(
  tabId: number,
  message: unknown,
  deps: SendTabMessageAllFramesDeps = {},
): Promise<void> {
  const webNavigation: TabFramesWebNavigation =
    deps.webNavigation ??
    ({
      getAllFrames: (details) => chrome.webNavigation.getAllFrames(details),
    } satisfies TabFramesWebNavigation);
  const tabs: TabFramesTabs =
    deps.tabs ??
    ({
      sendMessage: (id, msg, options) =>
        options === undefined
          ? chrome.tabs.sendMessage(id, msg)
          : chrome.tabs.sendMessage(id, msg, options),
    } satisfies TabFramesTabs);

  const frames = await listFrames(tabId, webNavigation);
  if (!frames || frames.length === 0) {
    try {
      await tabs.sendMessage(tabId, message);
    } catch {
      // content script 未注入
    }
    return;
  }

  await Promise.all(
    frames.map(async (frame) => {
      try {
        await tabs.sendMessage(tabId, message, { frameId: frame.frameId });
      } catch {
        // 无 CS / about:blank 等
      }
    }),
  );
}
