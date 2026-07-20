/** 与 Habitat Edge TTS 路由上限保持一致 */
export const MAX_HUB_TTS_TEXT_LENGTH = 4096;

/** 首段上限 */
export const FIRST_HUB_TTS_CHUNK_MAX = 200;

/**
 * 超过此长度才启用分段朗读。
 * 与首段上限对齐：短于/等于首段可整段合成，避免短句被强制切开。
 */
export const MIN_HUB_TTS_SPLIT_LEN = FIRST_HUB_TTS_CHUNK_MAX;

/** 第二段字数范围 */
export const SECOND_HUB_TTS_CHUNK_MIN = 100;
export const SECOND_HUB_TTS_CHUNK_MAX = 200;

/** 第三段及以后字数范围 */
export const LATER_HUB_TTS_CHUNK_MIN = 500;
export const LATER_HUB_TTS_CHUNK_MAX = 1000;
