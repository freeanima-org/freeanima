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

import { defineHubMethod, dualCrudMeta } from "../method-def.ts";

export const taskMethodDefs = {
  "tasklist.list": defineHubMethod({
    input: tasklistListInputSchema,
    output: tasklistListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "tasklist.create": defineHubMethod({
    input: tasklistCreateInputSchema,
    output: tasklistCreateOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "tasklist.patch": defineHubMethod({
    input: tasklistPatchInputSchema,
    output: tasklistPatchOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "tasklist.delete": defineHubMethod({
    input: tasklistDeleteInputSchema,
    output: tasklistDeleteOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "task.list": defineHubMethod({
    input: taskListInputSchema,
    output: taskListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "task.create": defineHubMethod({
    input: taskCreateInputSchema,
    output: taskCreateOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "task.patch": defineHubMethod({
    input: taskPatchInputSchema,
    output: taskPatchOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "task.complete": defineHubMethod({
    input: taskCompleteInputSchema,
    output: taskCompleteOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "task.uncomplete": defineHubMethod({
    input: taskUncompleteInputSchema,
    output: taskUncompleteOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "task.delete": defineHubMethod({
    input: taskDeleteInputSchema,
    output: taskDeleteOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "task.search": defineHubMethod({
    input: taskSearchInputSchema,
    output: taskSearchOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
} as const;
