import { omitUndefined } from "@freeanima/habitat/core/util";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { noteMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type NoteRemoteToolsServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): NoteRemoteToolsServerDeps {
  return deps as NoteRemoteToolsServerDeps;
}

export const noteHabitatRoutes = bindHabitatRouteHandlers(noteMethodDefs, {
  "note.list": async (deps, input) =>
    service.serviceNoteList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.create": async (deps, input) =>
    service.serviceNoteCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.append": async (deps, input) =>
    service.serviceNoteAppend(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.patch": async (deps, input) =>
    service.serviceNotePatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.delete": async (deps, input) =>
    service.serviceNoteDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "note.get": async (deps, input) =>
    service.serviceNoteGet(depsOf(deps).runtime.runtimeDeps(), input),
  "note.search": async (deps, input) =>
    service.serviceNoteSearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.blockCreate": async (deps, input) =>
    service.serviceNoteBlockCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.blockPatch": async (deps, input) =>
    service.serviceNoteBlockPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "note.blockDelete": async (deps, input) =>
    service.serviceNoteBlockDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "note.blockReorder": async (deps, input) =>
    service.serviceNoteBlockReorder(depsOf(deps).runtime.runtimeDeps(), input),
});
