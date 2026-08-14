import { afterEach, beforeEach, expect, it } from "bun:test";

import {
  deleteEntity,
  getEntity,
  purgeSoftDeletedEntities,
} from "@freeanima/host/core/db/pg/entity";
import {
  bindObjectStore,
  createObjectFile,
  createObjectStore,
  gcObjectBlobsAfterEntityPurge,
  getObjectFile,
  getObjectStore,
  resetObjectStoreForTest,
  updateObjectFile,
} from "@freeanima/features/object-storage/domain";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";

describePg("object_file blob GC / reference release", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-object-file-gc-");
    bindObjectStore(createObjectStore({}));
  });

  afterEach(async () => {
    resetObjectStoreForTest();
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("releases sole-owned cid after updateObjectFile replaces bytes", async () => {
    const worldId = testUserWorldId();
    const file = await createObjectFile({
      world_id: worldId,
      title: "sole.bin",
      bytes: new Uint8Array([1, 2, 3]),
    });
    const oldCid = file.cid;
    expect(await getObjectStore().exists(worldId, oldCid)).toBe(true);

    const updated = await updateObjectFile({
      id: file.id,
      bytes: new Uint8Array([9, 9, 9, 9]),
    });
    expect(updated.cid).not.toBe(oldCid);
    expect(await getObjectStore().exists(worldId, updated.cid)).toBe(true);
    expect(await getObjectStore().exists(worldId, oldCid)).toBe(false);
  });

  it("keeps shared cid when another object_file still references it", async () => {
    const worldId = testUserWorldId();
    const bytes = new Uint8Array([4, 5, 6]);
    const a = await createObjectFile({
      world_id: worldId,
      title: "a.bin",
      bytes,
    });
    const b = await createObjectFile({
      world_id: worldId,
      title: "b.bin",
      bytes,
    });
    expect(a.cid).toBe(b.cid);
    const sharedCid = a.cid;

    const updated = await updateObjectFile({
      id: a.id,
      bytes: new Uint8Array([7, 8]),
    });
    expect(updated.cid).not.toBe(sharedCid);
    expect(await getObjectStore().exists(worldId, sharedCid)).toBe(true);
    expect(await getObjectStore().exists(worldId, updated.cid)).toBe(true);

    const stillB = await getObjectFile(b.id);
    expect(stillB?.cid).toBe(sharedCid);
    expect(await getObjectStore().get(worldId, sharedCid)).toEqual(bytes);
  });

  it("purge + gc deletes blob when last object_file reference is gone", async () => {
    const worldId = testUserWorldId();
    const file = await createObjectFile({
      world_id: worldId,
      title: "purge-me.bin",
      bytes: new Uint8Array([10, 11, 12]),
    });
    const cid = file.cid;
    expect(await getObjectStore().exists(worldId, cid)).toBe(true);

    expect(await deleteEntity(file.id)).toBe(true);
    const soft = await getEntity(file.id, { include_deleted: true });
    expect(soft?.deleted_at).not.toBeNull();
    expect(await getObjectStore().exists(worldId, cid)).toBe(true);

    const purge = await purgeSoftDeletedEntities({ olderThan: new Date() });
    expect(purge.purged).toBeGreaterThanOrEqual(1);
    const gc = await gcObjectBlobsAfterEntityPurge(purge.rows);
    expect(gc.deleted).toBeGreaterThanOrEqual(1);
    expect(await getObjectStore().exists(worldId, cid)).toBe(false);
  });
});
