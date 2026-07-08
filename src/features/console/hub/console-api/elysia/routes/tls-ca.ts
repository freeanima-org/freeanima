import { Elysia } from "elysia";

import { getTlsCaInfo, getTlsCaPemResponse, getTlsCaQrResponse } from "../../handlers/tls-ca.ts";

export const tlsCaRoutes = new Elysia()
  .get("/tls/ca/info", async ({ request }) => getTlsCaInfo(request))
  .get("/tls/ca/qr", async ({ request, set }) => {
    const res = await getTlsCaQrResponse(request);
    if (!res) {
      set.status = 404;
      return { error: "TLS_CA_UNAVAILABLE" };
    }
    return res;
  })
  .get("/tls/ca", ({ set }) => {
    const res = getTlsCaPemResponse();
    if (!res) {
      set.status = 404;
      return { error: "TLS_CA_UNAVAILABLE" };
    }
    return res;
  });
