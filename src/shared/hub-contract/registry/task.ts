import {
  tasklistCreateInputSchema,
  tasklistCreateOutputSchema,
  tasklistDeleteInputSchema,
  tasklistDeleteOutputSchema,
  tasklistListInputSchema,
  tasklistListOutputSchema,
  tasklistPatchInputSchema,
  tasklistPatchOutputSchema,
  taskCompleteInputSchema,
  taskCompleteOutputSchema,
  taskCreateInputSchema,
  taskCreateOutputSchema,
  taskDeleteInputSchema,
  taskDeleteOutputSchema,
  taskListInputSchema,
  taskListOutputSchema,
  taskPatchInputSchema,
  taskPatchOutputSchema,
  taskSearchInputSchema,
  taskSearchOutputSchema,
  taskUncompleteInputSchema,
  taskUncompleteOutputSchema,
} from "@freeanima/sap-contract/frames/task";

import { defineHubMethod, dualTransportMeta } from "../method-def.ts";

export const taskMethodDefs = {
  "tasklist.list": defineHubMethod({
    input: tasklistListInputSchema,
    output: tasklistListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tasklist.create": defineHubMethod({
    input: tasklistCreateInputSchema,
    output: tasklistCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tasklist.patch": defineHubMethod({
    input: tasklistPatchInputSchema,
    output: tasklistPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tasklist.delete": defineHubMethod({
    input: tasklistDeleteInputSchema,
    output: tasklistDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "task.list": defineHubMethod({
    input: taskListInputSchema,
    output: taskListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "task.create": defineHubMethod({
    input: taskCreateInputSchema,
    output: taskCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "task.patch": defineHubMethod({
    input: taskPatchInputSchema,
    output: taskPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "task.complete": defineHubMethod({
    input: taskCompleteInputSchema,
    output: taskCompleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "task.uncomplete": defineHubMethod({
    input: taskUncompleteInputSchema,
    output: taskUncompleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "task.delete": defineHubMethod({
    input: taskDeleteInputSchema,
    output: taskDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "task.search": defineHubMethod({
    input: taskSearchInputSchema,
    output: taskSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
