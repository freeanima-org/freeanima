import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context.ts";
import {
  runIntegrityChecks,
  type DataIntegrityReport,
} from "@freeanima/habitat/core/db/pg/data-integrity/index.ts";

const UI_ISSUE_LIMIT = 500;

/** 数据维护：手动跑通用数据完整性检查 */
export async function runDataIntegrityCheck(): Promise<DataIntegrityReport> {
  try {
    const ctx = getResolvedWorldContext();
    return runIntegrityChecks({
      configuredSubjects: {
        user_subject_id: ctx.user_subject_id,
        agent_subject_id: ctx.agent_subject_id,
      },
      issueLimit: UI_ISSUE_LIMIT,
    });
  } catch {
    return runIntegrityChecks({ issueLimit: UI_ISSUE_LIMIT });
  }
}
