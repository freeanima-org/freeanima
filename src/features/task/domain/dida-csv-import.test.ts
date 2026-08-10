import { describe, expect, test } from "bun:test";

import {
  buildDidaPreviewRows,
  parseDidaCsv,
  planDidaImport,
  reminderDurationToAt,
} from "./dida-csv-import.ts";

const SAMPLE = `"Date: 2026-08-10+0000"
"Version: 7.2"
"Status: 
0 Normal
-1 Abandoned 
2 Completed"
"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId","projectKind"
"旅游计划","杭州行","预定飞机票","TEXT","旅行","","N","2025-08-03T16:00:00+0000","2025-08-03T16:00:00+0000","P0DT9H0M0S","FREQ=YEARLY","5","0","2025-07-17T03:58:11+0000","","0","Asia/Shanghai","true","false",,,"list","1","","TASK"
"","个人事务","理发","TEXT","","","N","2026-09-06T10:00:00+0000","2026-09-06T10:00:00+0000","-PT60M
PT0S","FREQ=MONTHLY;BYMONTHDAY=13","1","0","2025-07-07T02:41:48+0000","","10","Asia/Shanghai","false","false",,,"list","2","","TASK"
"","个人事务","已放弃","TEXT","","","N","","","","","0","-1","2025-07-07T02:41:48+0000","","20","Asia/Shanghai","true","false",,,"list","3","","TASK"
"","木疙瘩","子任务","TEXT","","","N","","","","","0","2","2025-07-07T02:41:48+0000","2025-07-08T00:00:00+0000","30","Asia/Shanghai","true","false",,,"list","4","2","TASK"
"","木疙瘩","时段","TEXT","","","N","2025-07-25T22:25:00+0000","2025-07-26T00:37:00+0000","","","5","2","2025-07-17T02:31:47+0000","2025-07-26T01:23:44+0000","40","Asia/Shanghai","false","false",,,"list","5","","TASK"
"","生活","自定义","TEXT","","","N","2026-08-01T16:00:00+0000","2026-08-01T16:00:00+0000","","ERULE:NAME=CUSTOM;BYDATE=20250903","0","0","2025-07-07T02:41:48+0000","","2281701376","Asia/Shanghai","true","false",,,"list","6","","TASK"
`;

describe("reminderDurationToAt", () => {
  const due = "2026-09-06T10:00:00+00:00";
  test("相对提前", () => {
    const at = reminderDurationToAt("-PT60M", due);
    expect(at).toBeTruthy();
    expect(Date.parse(at!)).toBe(Date.parse(due) - 60 * 60 * 1000);
  });
  test("截止时", () => {
    const at = reminderDurationToAt("PT0S", due);
    expect(Date.parse(at!)).toBe(Date.parse(due));
  });
  test("当天 09:00", () => {
    const at = reminderDurationToAt("P0DT9H0M0S", "2026-08-23T16:00:00+0000");
    expect(at).toContain("09:00:00");
  });
});

describe("parseDidaCsv", () => {
  test("解析样例子集", () => {
    const parsed = parseDidaCsv(SAMPLE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.version).toBe("7.2");
    expect(parsed.skipped_abandoned).toBe(1);
    expect(parsed.skipped_tasks.length).toBe(1);
    expect(parsed.skipped_tasks[0]?.title).toBe("已放弃");
    expect(parsed.lists.some((l) => l.is_folder && l.name === "旅游计划")).toBe(true);
    expect(parsed.tasks.length).toBe(5);
    const yearly = parsed.tasks.find((t) => t.client_op_id === "dida:1");
    expect(yearly?.recurrence?.freq).toBe("yearly");
    expect(yearly?.reminders.length).toBe(1);
    const multi = parsed.tasks.find((t) => t.client_op_id === "dida:2");
    expect(multi?.reminders.length).toBe(2);
    const child = parsed.tasks.find((t) => t.client_op_id === "dida:4");
    expect(child?.parent_task_op_id).toBe("dida:2");
    const range = parsed.tasks.find((t) => t.client_op_id === "dida:5");
    expect(range?.start_at).toBeTruthy();
    expect(range?.due_at).toBeTruthy();
    expect(range?.status).toBe("completed");
    const custom = parsed.tasks.find((t) => t.client_op_id === "dida:6");
    expect(custom?.recurrence).toBeNull();
    expect(custom?.warnings.some((w) => w.includes("未映射"))).toBe(true);
    expect(custom?.sort_order).toBe(2_147_483_647);
  });

  test("plan upsert", () => {
    const parsed = parseDidaCsv(SAMPLE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const existing = new Map<string, number>([["dida:1", 99]]);
    const plan = planDidaImport(parsed, existing, "upsert");
    const t1 = plan.find((e) => e.kind === "task" && e.mapped.client_op_id === "dida:1");
    expect(t1?.action).toBe("update");
    const t2 = plan.find((e) => e.kind === "task" && e.mapped.client_op_id === "dida:2");
    expect(t2?.action).toBe("create");
  });

  test("preview 三分桶", () => {
    const parsed = parseDidaCsv(SAMPLE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const buckets = buildDidaPreviewRows(parsed);
    expect(buckets.skipped.length).toBe(1);
    expect(buckets.warn.length).toBeGreaterThanOrEqual(1);
    expect(buckets.ok.length + buckets.warn.length).toBe(parsed.tasks.length);
    expect(buckets.warn.some((r) => r.note.includes("未映射"))).toBe(true);
  });
});
