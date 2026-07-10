import {
  diaryAppendInputSchema,
  diaryAppendOutputSchema,
  diaryCreateInputSchema,
  diaryCreateOutputSchema,
  diaryDeleteInputSchema,
  diaryDeleteOutputSchema,
  diaryGetInputSchema,
  diaryGetOutputSchema,
  diaryListInputSchema,
  diaryListOutputSchema,
  diaryPatchInputSchema,
  diaryPatchOutputSchema,
  diarySearchInputSchema,
  diarySearchOutputSchema,
} from "@freeanima/shared/sap-contract/frames/diary";
import {
  dreamGetInputSchema,
  dreamGetOutputSchema,
  dreamListInputSchema,
  dreamListOutputSchema,
} from "@freeanima/shared/sap-contract/frames/dream";
import {
  emailAccountListInputSchema,
  emailAccountListOutputSchema,
  emailMessageListInputSchema,
  emailMessageListOutputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageMarkReadOutputSchema,
  emailMessageReadInputSchema,
  emailMessageReadOutputSchema,
  emailMessageSearchInputSchema,
  emailMessageSearchOutputSchema,
  emailSyncInputSchema,
  emailSyncOutputSchema,
  emailThreadListInputSchema,
  emailThreadListOutputSchema,
} from "@freeanima/shared/sap-contract/frames/email";
import {
  notificationListInputSchema,
  notificationListOutputSchema,
  notificationMarkReadInputSchema,
  notificationMarkReadOutputSchema,
  notificationRecipientsOutputSchema,
} from "@freeanima/shared/sap-contract/frames/notification";
import {
  companionConfigGetInputSchema,
  companionConfigGetOutputSchema,
  companionConfigUpdateInputSchema,
  companionConfigUpdateOutputSchema,
  companionMigrateFromLocalInputSchema,
  companionMigrateFromLocalOutputSchema,
  companionModelDeleteInputSchema,
  companionModelDeleteOutputSchema,
  companionModelRenameInputSchema,
  companionModelRenameOutputSchema,
  companionModelSetActiveInputSchema,
  companionModelSetActiveOutputSchema,
  companionMotionDeleteInputSchema,
  companionMotionDeleteOutputSchema,
  companionMotionRenameInputSchema,
  companionMotionRenameOutputSchema,
  companionMotionSetSlotInputSchema,
  companionMotionSetSlotOutputSchema,
  companionSyncPullInputSchema,
  companionSyncPullOutputSchema,
} from "@freeanima/shared/sap-contract/frames/companion";
import {
  pomodoroConfigGetInputSchema,
  pomodoroConfigGetOutputSchema,
  pomodoroConfigUpdateInputSchema,
  pomodoroConfigUpdateOutputSchema,
  pomodoroFocusListInputSchema,
  pomodoroFocusListOutputSchema,
  pomodoroSessionAbortInputSchema,
  pomodoroSessionAbortOutputSchema,
  pomodoroSessionCompleteInputSchema,
  pomodoroSessionCompleteOutputSchema,
  pomodoroSessionListInputSchema,
  pomodoroSessionListOutputSchema,
  pomodoroSessionStatsInputSchema,
  pomodoroSessionStatsOutputSchema,
  pomodoroActiveGetInputSchema,
  pomodoroActiveGetOutputSchema,
  pomodoroActivePutInputSchema,
  pomodoroActivePutOutputSchema,
  pomodoroActiveClearInputSchema,
  pomodoroActiveClearOutputSchema,
} from "@freeanima/shared/sap-contract/frames/pomodoro";
import { z } from "zod";

import { defineHubMethod, dualTransportMeta, binaryHttpMeta } from "../method-def.ts";

const emptyInputSchema = z.object({}).passthrough();
const companionAssetGetInputSchema = z.object({
  kind: z.enum(["models", "motions"]),
  fileName: z.string().min(1),
});
const companionUploadOkOutputSchema = z.object({ ok: z.literal(true) });

export const emailMethodDefs = {
  "emailaccount.list": defineHubMethod({
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.list": defineHubMethod({
    input: emailMessageListInputSchema,
    output: emailMessageListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.read": defineHubMethod({
    input: emailMessageReadInputSchema,
    output: emailMessageReadOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.markRead": defineHubMethod({
    input: emailMessageMarkReadInputSchema,
    output: emailMessageMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.search": defineHubMethod({
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.sync": defineHubMethod({
    input: emailSyncInputSchema,
    output: emailSyncOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailthread.list": defineHubMethod({
    input: emailThreadListInputSchema,
    output: emailThreadListOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const diaryMethodDefs = {
  "diary.list": defineHubMethod({
    input: diaryListInputSchema,
    output: diaryListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.create": defineHubMethod({
    input: diaryCreateInputSchema,
    output: diaryCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.append": defineHubMethod({
    input: diaryAppendInputSchema,
    output: diaryAppendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.patch": defineHubMethod({
    input: diaryPatchInputSchema,
    output: diaryPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.delete": defineHubMethod({
    input: diaryDeleteInputSchema,
    output: diaryDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.get": defineHubMethod({
    input: diaryGetInputSchema,
    output: diaryGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.search": defineHubMethod({
    input: diarySearchInputSchema,
    output: diarySearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const dreamMethodDefs = {
  "dream.list": defineHubMethod({
    input: dreamListInputSchema,
    output: dreamListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "dream.get": defineHubMethod({
    input: dreamGetInputSchema,
    output: dreamGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const notificationMethodDefs = {
  "notification.list": defineHubMethod({
    input: notificationListInputSchema,
    output: notificationListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "notification.markRead": defineHubMethod({
    input: notificationMarkReadInputSchema,
    output: notificationMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "notification.recipients": defineHubMethod({
    input: emptyInputSchema,
    output: notificationRecipientsOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const pomodoroMethodDefs = {
  "pomodoro.config.get": defineHubMethod({
    input: pomodoroConfigGetInputSchema,
    output: pomodoroConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.config.update": defineHubMethod({
    input: pomodoroConfigUpdateInputSchema,
    output: pomodoroConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.complete": defineHubMethod({
    input: pomodoroSessionCompleteInputSchema,
    output: pomodoroSessionCompleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.abort": defineHubMethod({
    input: pomodoroSessionAbortInputSchema,
    output: pomodoroSessionAbortOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.session.list": defineHubMethod({
    input: pomodoroSessionListInputSchema,
    output: pomodoroSessionListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.session.stats": defineHubMethod({
    input: pomodoroSessionStatsInputSchema,
    output: pomodoroSessionStatsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.focus.list": defineHubMethod({
    input: pomodoroFocusListInputSchema,
    output: pomodoroFocusListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.active.get": defineHubMethod({
    input: pomodoroActiveGetInputSchema,
    output: pomodoroActiveGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "pomodoro.active.put": defineHubMethod({
    input: pomodoroActivePutInputSchema,
    output: pomodoroActivePutOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "pomodoro.active.clear": defineHubMethod({
    input: pomodoroActiveClearInputSchema,
    output: pomodoroActiveClearOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

export const companionMethodDefs = {
  "companion.config.get": defineHubMethod({
    input: companionConfigGetInputSchema,
    output: companionConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.config.update": defineHubMethod({
    input: companionConfigUpdateInputSchema,
    output: companionConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.setActive": defineHubMethod({
    input: companionModelSetActiveInputSchema,
    output: companionModelSetActiveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.rename": defineHubMethod({
    input: companionModelRenameInputSchema,
    output: companionModelRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.delete": defineHubMethod({
    input: companionModelDeleteInputSchema,
    output: companionModelDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.setSlot": defineHubMethod({
    input: companionMotionSetSlotInputSchema,
    output: companionMotionSetSlotOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.rename": defineHubMethod({
    input: companionMotionRenameInputSchema,
    output: companionMotionRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.delete": defineHubMethod({
    input: companionMotionDeleteInputSchema,
    output: companionMotionDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.migrate.fromLocal": defineHubMethod({
    input: companionMigrateFromLocalInputSchema,
    output: companionMigrateFromLocalOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.sync.pull": defineHubMethod({
    input: companionSyncPullInputSchema,
    output: companionSyncPullOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.asset.get": defineHubMethod({
    input: companionAssetGetInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "GET",
      path: "companion/assets/:kind/:fileName",
      pathParams: ["kind", "fileName"],
      response: "raw",
    }),
  }),
  "companion.model.upload": defineHubMethod({
    input: emptyInputSchema,
    output: companionUploadOkOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/model/upload",
      request: "multipart",
    }),
  }),
  "companion.motion.import": defineHubMethod({
    input: emptyInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/motion/import",
      request: "multipart",
    }),
  }),
} as const;
