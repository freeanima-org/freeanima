import { resolveSubjectWorldId, type SubjectKind } from "@freeanima/host/core/config";

export function resolveVaultWorldId(subject_kind: SubjectKind): number {
  return resolveSubjectWorldId(subject_kind);
}
