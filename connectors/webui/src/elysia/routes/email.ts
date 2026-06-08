import { Elysia } from "elysia";
import { fetchAccountEmails, getEmailOverview } from "../../handlers/email.ts";

export const emailRoutes = new Elysia({ prefix: "/email" })
  .get("/", () => getEmailOverview())
  .post("/:id/fetch", ({ params }) => fetchAccountEmails(params.id));
