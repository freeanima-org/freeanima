import { expect, it } from "bun:test";
import {
  createTrustedSatellite,
  getTrustedSatellite,
  listTrustedSatellites,
  revokeTrustedSatellite,
} from "@freeanima/habitat/core/db/pg/federation";
import { describePg } from "../../helpers/pg-test-gate.ts";

describePg("habitat_trusted_satellites", () => {
  it("creates, lists, and revokes trusted satellite", async () => {
    const id = "fa_inst_test_satellite_01";
    const created = await createTrustedSatellite({
      satellite_habitat_instance_id: id,
      satellite_public_key: "test_pubkey",
      label: "测试节点",
    });
    expect(created.status).toBe("trusted");

    const fetched = await getTrustedSatellite(id);
    expect(fetched?.satellite_public_key).toBe("test_pubkey");

    const list = await listTrustedSatellites();
    expect(list.some((row) => row.satellite_habitat_instance_id === id)).toBe(true);

    const revoked = await revokeTrustedSatellite(id);
    expect(revoked?.status).toBe("revoked");
  });
});
