import {
  sessionAcpDockInputSchema,
  sessionAcpDockOutputSchema,
} from "@freeanima/sap-contract/frames/acp";
import {
  conversationArchiveInputSchema,
  conversationCommandsInputSchema,
  conversationCommandsOutputSchema,
  conversationCreateInputSchema,
  conversationCreateOutputSchema,
  conversationDeleteInputSchema,
  conversationListInputSchema,
  conversationListOutputSchema,
  conversationMessagesInputSchema,
  conversationMutateOutputSchema,
  conversationPatchTitleInputSchema,
  conversationSubscribeInputSchema,
  conversationUnarchiveInputSchema,
} from "@freeanima/sap-contract/frames/conversation";
import {
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  messageSendInputSchema,
  messageSendOutputSchema,
} from "@freeanima/sap-contract/frames/message";
import { z } from "zod";

import { defineHubMethod, dualCrudMeta, wsOnlyMeta } from "../method-def.ts";

const conversationMessagesOutputSchema = z.record(z.string(), z.unknown());
const conversationPatchTitleOutputSchema = z.object({ ok: z.literal(true) });
const conversationSubscribeOutputSchema = z.object({ ok: z.literal(true) });

export const chatMethodDefs = {
  "conversation.create": defineHubMethod({
    input: conversationCreateInputSchema,
    output: conversationCreateOutputSchema,
    meta: dualCrudMeta({ method: "POST", path: "/api/conversations" }, false),
  }),
  "conversation.list": defineHubMethod({
    input: conversationListInputSchema,
    output: conversationListOutputSchema,
    meta: dualCrudMeta({ method: "GET", path: "/api/conversations" }, true),
  }),
  "conversation.messages": defineHubMethod({
    input: conversationMessagesInputSchema,
    output: conversationMessagesOutputSchema,
    meta: dualCrudMeta(
      { method: "GET", path: "/api/conversations/{conversation_id}/messages" },
      true,
    ),
  }),
  "conversation.patchTitle": defineHubMethod({
    input: conversationPatchTitleInputSchema,
    output: conversationPatchTitleOutputSchema,
    meta: dualCrudMeta(
      { method: "PATCH", path: "/api/conversations/{conversation_id}/title" },
      false,
    ),
  }),
  "conversation.archive": defineHubMethod({
    input: conversationArchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.unarchive": defineHubMethod({
    input: conversationUnarchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.delete": defineHubMethod({
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.rollbackBeforeLastUser": defineHubMethod({
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.subscribe": defineHubMethod({
    input: conversationSubscribeInputSchema,
    output: conversationSubscribeOutputSchema,
    meta: {
      transports: ["http", "ws"],
      defaultByProfile: { console: "http", satellite: "ws" },
      fallback: false,
      http: {
        method: "GET",
        path: "/api/conversations/{conversation_id}/events",
        sse: true,
      },
    },
  }),
  "conversation.acpDock": defineHubMethod({
    input: sessionAcpDockInputSchema,
    output: sessionAcpDockOutputSchema,
    meta: dualCrudMeta(
      { method: "GET", path: "/api/conversations/{conversation_id}/acp-dock" },
      true,
    ),
  }),
  "conversation.commands": defineHubMethod({
    input: conversationCommandsInputSchema,
    output: conversationCommandsOutputSchema,
    meta: dualCrudMeta({ method: "GET", path: "/api/conversations/commands" }, true),
  }),
  "message.send": defineHubMethod({
    input: messageSendInputSchema,
    output: messageSendOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "message.interrupt": defineHubMethod({
    input: messageInterruptInputSchema,
    output: messageInterruptOutputSchema,
    meta: wsOnlyMeta(),
  }),
} as const;
