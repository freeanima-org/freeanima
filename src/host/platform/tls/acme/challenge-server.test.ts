import { describe, expect, test, beforeEach } from "bun:test";

import {
  clearHttp01Challenges,
  setHttp01Challenge,
  removeHttp01Challenge,
} from "./challenge-store.ts";
import { handleAcmeChallengeRequest } from "./challenge-server.ts";

describe("acme challenge-server", () => {
  beforeEach(() => {
    clearHttp01Challenges();
  });

  test("returns keyAuthorization for known token", () => {
    setHttp01Challenge("tok1", "tok1.abc");
    const res = handleAcmeChallengeRequest(
      new Request("http://127.0.0.1/.well-known/acme-challenge/tok1"),
    );
    expect(res.status).toBe(200);
    return res.text().then((body) => {
      expect(body).toBe("tok1.abc");
    });
  });

  test("404 for unknown token", () => {
    const res = handleAcmeChallengeRequest(
      new Request("http://127.0.0.1/.well-known/acme-challenge/missing"),
    );
    expect(res.status).toBe(404);
  });

  test("404 after remove", () => {
    setHttp01Challenge("tok2", "x");
    removeHttp01Challenge("tok2");
    const res = handleAcmeChallengeRequest(
      new Request("http://127.0.0.1/.well-known/acme-challenge/tok2"),
    );
    expect(res.status).toBe(404);
  });

  test("404 for non-challenge path", () => {
    const res = handleAcmeChallengeRequest(new Request("http://127.0.0.1/health"));
    expect(res.status).toBe(404);
  });
});
