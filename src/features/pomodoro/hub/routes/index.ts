import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { pomodoroMethodDefs } from "@freeanima/shared/hub-contract/registry/features.ts";

import {
  handlePomodoroActiveClear,
  handlePomodoroActiveGet,
  handlePomodoroActivePut,
  handlePomodoroConfigGet,
  handlePomodoroConfigUpdate,
  handlePomodoroFocusList,
  handlePomodoroSessionAbort,
  handlePomodoroSessionComplete,
  handlePomodoroSessionList,
  handlePomodoroSessionStats,
} from "../rpc.ts";

export const pomodoroHubRoutes = attachHandlersToDefs(pomodoroMethodDefs, {
  "pomodoro.config.get": handlePomodoroConfigGet,
  "pomodoro.config.update": handlePomodoroConfigUpdate,
  "pomodoro.session.complete": handlePomodoroSessionComplete,
  "pomodoro.session.abort": handlePomodoroSessionAbort,
  "pomodoro.session.list": handlePomodoroSessionList,
  "pomodoro.session.stats": handlePomodoroSessionStats,
  "pomodoro.focus.list": handlePomodoroFocusList,
  "pomodoro.active.get": handlePomodoroActiveGet,
  "pomodoro.active.put": handlePomodoroActivePut,
  "pomodoro.active.clear": handlePomodoroActiveClear,
} as Record<keyof typeof pomodoroMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
