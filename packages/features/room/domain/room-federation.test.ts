import { describe, expect, it } from "bun:test";

import {
  formatFederatedRoomId,
  isFederatedRoomId,
  parseFederatedRoomId,
} from "./room-federation.ts";

describe("federated room id", () => {
  it("formats and parses room-{hub}-{nanoid}", () => {
    const hub = "fa_inst_hubabc123";
    const id = formatFederatedRoomId(hub, "localxyz");
    expect(id).toBe("room-fa_inst_hubabc123-localxyz");
    expect(isFederatedRoomId(id)).toBe(true);
    expect(parseFederatedRoomId(id)).toEqual({
      hub_instance_id: hub,
      local_id: "localxyz",
    });
  });

  it("rejects non-federated ids", () => {
    expect(isFederatedRoomId("plain_room_id")).toBe(false);
    expect(parseFederatedRoomId("room-not-a-hub-id")).toBeNull();
  });
});
