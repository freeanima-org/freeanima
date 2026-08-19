import {
  deriveEd25519KeyPair,
  SUBJECT_ED25519_INFO,
  subjectKeySalt,
} from "@freeanima/shared/identity";
import { randomPublicId } from "@freeanima/shared/util";
import { subjectConfigBodySchema, type EntityRow } from "@freeanima/habitat/core/db/schema/entity";
import { updateEntity } from "@freeanima/habitat/core/db/pg/entity/repos/entity-crud-repo.ts";

export type SubjectCryptoMaterial = {
  public_id: string;
  public_key: string;
  private_key: string;
};

/** 确保 subject body 有 public_id/public_key，并返回含私钥的材料（私钥由调用方写入 identity.subject_keys） */
export async function ensureSubjectCryptoMaterial(
  subject: EntityRow,
  habitatInstanceId: string,
  existingPrivateKey?: string,
): Promise<{ subject: EntityRow; material: SubjectCryptoMaterial }> {
  const parsed = subjectConfigBodySchema.safeParse(subject.body);
  const body = parsed.success ? { ...parsed.data } : {};
  let public_id = body.public_id?.trim() || "";
  let public_key = body.public_key?.trim() || "";
  let private_key = existingPrivateKey?.trim() || "";

  if (!public_id || !public_key || !private_key) {
    if (!public_id) public_id = randomPublicId();
    const keys = deriveEd25519KeyPair({
      salt: subjectKeySalt(habitatInstanceId, public_id),
      info: SUBJECT_ED25519_INFO,
    });
    public_key = keys.public_key;
    private_key = keys.private_key;
  }

  const needsBodyUpdate = body.public_id !== public_id || body.public_key !== public_key;
  let next = subject;
  if (needsBodyUpdate) {
    const prevBody =
      subject.body && typeof subject.body === "object" && !Array.isArray(subject.body)
        ? subject.body
        : {};
    const updated = await updateEntity({
      id: subject.id,
      body: {
        ...prevBody,
        public_id,
        public_key,
      },
    });
    if (updated) next = updated;
  }

  return {
    subject: next,
    material: { public_id, public_key, private_key },
  };
}
