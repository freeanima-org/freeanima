import { loadSessionMeta } from "@freeanima/legacy-engine";
import { logApiError, logSseError, isSessionMeta } from "@freeanima/legacy-kernel";
import type { NestService } from "@freeanima/legacy-runtime";
import { PARLOR_PLATFORM, buildFileTree, getStudioConfig, patchStudioConfig, readStudioFile, searchStudio } from "@freeanima/legacy-runtime";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { createNodeWebSocket } from "@hono/node-ws";

import {
  createSessionBodySchema,
  memorySearchBodySchema,
  patchTitleBodySchema,
  sendMessageBodySchema,
  studioConfigPatchSchema,
  studioSearchBodySchema,
} from "@freeanima/legacy-api";
import type { AcpManager, MCPManager } from "@freeanima/legacy-integrations";
import { studioTerminalHandler } from "./studio-terminal.js";
import { zValidator } from "./zod-validator.js";
import {
  mapConfigToApi,
  mapCronJobsToApi,
  mapHealthToApi,
  mapMessagesToApi,
  mapSessionsToApi,
  mapStatusToApi,
  mapStreamEventToApi,
} from "./api-mappers.js";
import { scheduleServiceRestart } from "./service-restart.js";

export type ApiDeps = {
  service: NestService;
  host: string;
  port: number;
  mcp: MCPManager | null;
  acp: AcpManager | null;
  upgradeWebSocket: ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];
};

function apiError(
  c: Context,
  status: 400 | 404 | 500 | 503,
  message: string,
  context?: Record<string, unknown>,
) {
  logApiError(c.req.method, c.req.path, status, message, context);
  return c.json({ error: message }, status);
}

function studioError(c: Context, status: 400 | 404 | 500, message: string) {
  return c.json({ error: message }, status);
}

async function resolveSessionPlatform(sessionId: string): Promise<string> {
  const meta = await loadSessionMeta(sessionId);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  return typeof p === "string" && p ? p : PARLOR_PLATFORM;
}

function handleMessageStream(
  c: Context,
  service: NestService,
  sessionId: string,
  message: string,
  platform: string,
) {
  const streamPath = c.req.path;

  return streamSSE(c, async (stream) => {
    let sawDone = false;
    try {
      for await (const event of service.sendMessageStream(sessionId, message, platform)) {
        const apiEvent = mapStreamEventToApi(event);
        if (apiEvent.event === "error") {
          const errMsg = apiEvent.data.error;
          logSseError(streamPath, errMsg, { session_id: sessionId });
        }
        if (apiEvent.event === "done") sawDone = true;
        await stream.writeSSE({
          event: apiEvent.event,
          data: JSON.stringify(apiEvent.data),
        });
      }
      if (!sawDone) {
        await stream.writeSSE({ event: "done", data: JSON.stringify({}) });
      }
    } catch (e) {
      logSseError(streamPath, e, { session_id: sessionId });
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ error: String(e) }),
      });
      await stream.writeSSE({ event: "done", data: JSON.stringify({}) });
    }
  });
}

export function createApiRoutes(deps: ApiDeps) {
  const { service, host, port, mcp, acp, upgradeWebSocket } = deps;

  return new Hono()
      .get("/health", (c) => c.json(mapHealthToApi(service.health())))
      .get("/status", async (c) =>
        c.json(mapStatusToApi(await service.buildStatus(host, port))),
      )
      .get("/sessions", async (c) => {
        const platform = c.req.query("platform") ?? undefined;
        const { sessions } = await service.listSessions(platform);
        return c.json({ sessions: mapSessionsToApi(sessions) });
      })
      .post("/sessions", zValidator("json", createSessionBodySchema), async (c) => {
        const body = c.req.valid("json");
        const platform = body.platform ?? PARLOR_PLATFORM;
        return c.json(await service.createSession(platform));
      })
      .get("/sessions/:sessionId", async (c) => {
        const sessionId = c.req.param("sessionId");
        try {
          return c.json(
            await service.getSessionInfo(sessionId, await resolveSessionPlatform(sessionId)),
          );
        } catch (e) {
          return apiError(c, 404, String(e), { session_id: sessionId });
        }
      })
      .get("/sessions/:sessionId/messages", async (c) => {
        const sessionId = c.req.param("sessionId");
        const offsetRaw = c.req.query("offset");
        const limitRaw = c.req.query("limit");
        const offset = offsetRaw !== undefined ? Number(offsetRaw) : undefined;
        const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
        try {
          const opts =
            offset !== undefined || limit !== undefined
              ? {
                  offset: Number.isFinite(offset) ? offset : 0,
                  limit: Number.isFinite(limit) ? limit : 100,
                }
              : undefined;
          return c.json(
            mapMessagesToApi(
              await service.getMessages(
                sessionId,
                await resolveSessionPlatform(sessionId),
                opts,
              ),
            ),
          );
        } catch (e) {
          return apiError(c, 404, String(e), { session_id: sessionId });
        }
      })
      .patch(
        "/sessions/:sessionId/title",
        zValidator("json", patchTitleBodySchema),
        async (c) => {
          const { title } = c.req.valid("json");
          const sessionId = c.req.param("sessionId");
          try {
            return c.json(
              await service.setSessionTitle(
                sessionId,
                title,
                await resolveSessionPlatform(sessionId),
              ),
            );
          } catch (e) {
            return apiError(c, 503, String(e), { session_id: sessionId });
          }
        },
      )
      .get("/commands", (c) => {
        const all = c.req.query("all") === "1";
        const platform = c.req.query("platform") ?? PARLOR_PLATFORM;
        return c.json(service.listCommands({ platform, all }));
      })
      .post(
        "/sessions/:sessionId/messages/stream",
        zValidator("json", sendMessageBodySchema),
        async (c) => {
          const { message } = c.req.valid("json");
          const sessionId = c.req.param("sessionId");
          const platform = await resolveSessionPlatform(sessionId);
          return handleMessageStream(c, service, sessionId, message, platform);
        },
      )
      .get("/memory", (c) => c.json(service.listMemoryFiles()))
      .post("/memory/search", zValidator("json", memorySearchBodySchema), (c) => {
        const body = c.req.valid("json");
        try {
          return c.json(
            service.memorySearch({
              query: body.query,
              limit: body.limit,
              session_limit: body.session_limit,
              session: body.session,
            }),
          );
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/memory/l2-distill", async (c) => {
        try {
          const { sessions } = await service.distillL2All();
          return c.json({
            ok: true,
            sessions,
            message: `L2 蒸馏完成：${sessions} 个 session 已写入 processed/`,
          });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/memory/l2-reindex", async (c) => {
        try {
          const { index_rows } = service.reindexL2All();
          return c.json({
            ok: true,
            index_rows,
            message: `L2 索引重建完成：${index_rows} 条消息已索引`,
          });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/memory/l3-reindex", async (c) => {
        try {
          const { index_rows } = service.reindexL3All();
          return c.json({
            ok: true,
            index_rows,
            message: `L3 索引重建完成：${index_rows} 条事实已索引`,
          });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/memory/l2-rebuild", async (c) => {
        try {
          const { sessions, index_rows } = await service.rebuildL2All();
          return c.json({
            ok: true,
            sessions,
            index_rows,
            message: `L2 全量重建完成：${sessions} 个 session 已蒸馏，${index_rows} 条消息已索引`,
          });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .get("/config", (c) => c.json(mapConfigToApi(service.getConfig()).config))
      .get("/tools", (c) => c.json(service.listToolsApi()))
      .get("/mcp", async (c) => {
        if (!mcp) {
          return c.json({
            server_count: 0,
            connected_count: 0,
            connecting_count: 0,
            tool_count: 0,
            servers: [],
          });
        }
        try {
          return c.json(await mcp.getStatus());
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/mcp/start-all", async (c) => {
        if (!mcp) return apiError(c, 503, "MCP manager not available");
        try {
          const result = await mcp.startAllEnabled();
          if (!result.ok) return apiError(c, 400, result.error ?? "start failed");
          return c.json({ ok: true, ...(await mcp.getStatus()) });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/mcp/stop-all", async (c) => {
        if (!mcp) return apiError(c, 503, "MCP manager not available");
        try {
          const result = await mcp.stopAll();
          if (!result.ok) return apiError(c, 400, result.error ?? "stop failed");
          return c.json({ ok: true, ...(await mcp.getStatus()) });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/mcp/:name/start", async (c) => {
        if (!mcp) return apiError(c, 503, "MCP manager not available");
        const name = c.req.param("name");
        try {
          const result = await mcp.startServer(name);
          if (!result.ok) return apiError(c, 400, result.error ?? "start failed", { server: name });
          return c.json({ ok: true, ...(await mcp.getStatus()) });
        } catch (e) {
          return apiError(c, 500, String(e), { server: name });
        }
      })
      .post("/mcp/:name/stop", async (c) => {
        if (!mcp) return apiError(c, 503, "MCP manager not available");
        const name = c.req.param("name");
        try {
          const result = await mcp.stopServer(name);
          if (!result.ok) return apiError(c, 400, result.error ?? "stop failed", { server: name });
          return c.json({ ok: true, ...(await mcp.getStatus()) });
        } catch (e) {
          return apiError(c, 500, String(e), { server: name });
        }
      })
      .get("/acp", (c) => {
        if (!acp) {
          return c.json({
            agent_count: 0,
            connected_count: 0,
            session_count: 0,
            tool_count: 0,
            agents: [],
          });
        }
        try {
          return c.json(acp.getStatus());
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/acp/start-all", async (c) => {
        if (!acp) return apiError(c, 503, "ACP manager not available");
        try {
          const result = await acp.startAll();
          if (!result.ok) return apiError(c, 400, result.error ?? "start failed");
          return c.json({ ok: true, ...acp.getStatus() });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/acp/stop-all", async (c) => {
        if (!acp) return apiError(c, 503, "ACP manager not available");
        try {
          const result = await acp.stopAll();
          if (!result.ok) return apiError(c, 400, result.error ?? "stop failed");
          return c.json({ ok: true, ...acp.getStatus() });
        } catch (e) {
          return apiError(c, 500, String(e));
        }
      })
      .post("/acp/:name/start", async (c) => {
        if (!acp) return apiError(c, 503, "ACP manager not available");
        const name = c.req.param("name");
        try {
          const result = await acp.startAgent(name);
          if (!result.ok) return apiError(c, 400, result.error ?? "start failed", { agent: name });
          return c.json({ ok: true, ...acp.getStatus() });
        } catch (e) {
          return apiError(c, 500, String(e), { agent: name });
        }
      })
      .post("/acp/:name/stop", async (c) => {
        if (!acp) return apiError(c, 503, "ACP manager not available");
        const name = c.req.param("name");
        try {
          const result = await acp.stopAgent(name);
          if (!result.ok) return apiError(c, 400, result.error ?? "stop failed", { agent: name });
          return c.json({ ok: true, ...acp.getStatus() });
        } catch (e) {
          return apiError(c, 500, String(e), { agent: name });
        }
      })
      .get("/cron", (c) => c.json(mapCronJobsToApi(service.listCronJobs().jobs)))
      .post("/cron/:id/pause", (c) => {
        const id = c.req.param("id");
        const job = service.pauseCronJob(id);
        if (!job) return apiError(c, 404, `未找到任务: ${id}`, { job_id: id });
        return c.json({ ok: true, job });
      })
      .post("/cron/:id/resume", (c) => {
        const id = c.req.param("id");
        const job = service.resumeCronJob(id);
        if (!job) return apiError(c, 404, `未找到任务: ${id}`, { job_id: id });
        return c.json({ ok: true, job });
      })
      .post("/cron/:id/run", (c) => {
        const id = c.req.param("id");
        const result = service.runCronJobNow(id);
        if (!result) return apiError(c, 404, `未找到任务: ${id}`, { job_id: id });
        return c.json({ ok: true, message: result.message, job: result.job });
      })
      .get("/studio/config", (c) => c.json(getStudioConfig()))
      .put("/studio/config", zValidator("json", studioConfigPatchSchema), (c) => {
        const body = c.req.valid("json");
        const patch: Record<string, unknown> = {};
        if (body.workspace !== undefined) patch.workspace = body.workspace;
        if (body.gitignore !== undefined) patch.gitignore = body.gitignore;
        if (body.showHidden !== undefined) patch.showHidden = body.showHidden;
        return c.json(patchStudioConfig(patch as Parameters<typeof patchStudioConfig>[0]));
      })
      .get("/studio/tree", (c) => {
        try {
          return c.json(buildFileTree());
        } catch (e) {
          const msg = String(e);
          const status = msg.includes("未配置") ? 400 : 404;
          return studioError(c, status, msg);
        }
      })
      .get("/studio/file", (c) => {
        const path = (c.req.query("path") ?? "").trim();
        if (!path) return studioError(c, 400, "path is required");
        try {
          return c.json(readStudioFile(path));
        } catch (e) {
          return studioError(c, 400, String(e));
        }
      })
      .post("/studio/search", zValidator("json", studioSearchBodySchema), (c) => {
        const { query } = c.req.valid("json");
        try {
          return c.json(searchStudio(query));
        } catch (e) {
          const msg = String(e);
          const status = msg.includes("未配置") ? 400 : 500;
          return studioError(c, status, msg);
        }
      })
      .get("/studio/terminal", upgradeWebSocket(() => studioTerminalHandler()))
      .post("/service/restart", (c) => {
        scheduleServiceRestart();
        return c.json({ ok: true, message: "服务正在重启..." });
      })
      .get("/platforms", (c) => c.json({ ok: true, data: service.getStatus().platforms }));
}

export type ApiRoutes = ReturnType<typeof createApiRoutes>;
