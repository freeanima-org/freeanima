import { z } from "zod";

const camofoxBrowserSchema = z.object({
  /** Camofox REST base URL (browser.camofox.base_url) */
  base_url: z.string().optional(),
  /** Single HTTP request timeout (ms); default 30000 when unset */
  timeout_ms: z.number().int().positive().optional(),
  /**
   * Persist a local Camofox profile (stable userId) across conversations.
   * Default true when unset; set false for ephemeral random userId.
   * See docs/tools/browser.md.
   */
  managed_persistence: z.boolean().optional(),
  /** Adopt existing Camofox tab after process restart; default true when unset */
  adopt_existing_tab: z.boolean().optional(),
  /** Explicit Camofox userId (shared browser profile); overrides managed_persistence when set */
  user_id: z.string().optional(),
  /** Explicit Camofox sessionKey; only applied when user_id is set */
  session_key: z.string().optional(),
});

export const browserSchema = z.object({
  camofox: camofoxBrowserSchema.optional(),
});
