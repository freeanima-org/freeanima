import { Elysia } from "elysia";
import { z } from "zod";
import {
  fetchAccountEmails,
  getEmailMessage,
  getEmailOverview,
  listAccountMessages,
  markEmailRead,
} from "../../handlers/email.ts";

const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});

export const emailRoutes = new Elysia({ prefix: "/email" })
  .get("/", () => getEmailOverview())
  .get(
    "/:accountId/messages",
    ({ params, query }) => {
      const { limit } = messagesQuerySchema.parse(query);
      return listAccountMessages(params.accountId, limit ?? 50);
    },
    { query: messagesQuerySchema },
  )
  .get("/:accountId/messages/:uid", ({ params }) =>
    getEmailMessage(params.accountId, Number(params.uid)),
  )
  .post("/:accountId/messages/:uid/read", ({ params }) =>
    markEmailRead(params.accountId, Number(params.uid)),
  )
  .post("/:accountId/fetch", ({ params }) => fetchAccountEmails(params.accountId));
