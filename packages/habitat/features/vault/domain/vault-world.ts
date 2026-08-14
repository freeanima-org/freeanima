import { resolveSubjectWorldId, type SubjectKind } from "@freeanima/habitat/core/config";

export function resolveVaultWorldId(subject_kind: SubjectKind): number {
  return resolveSubjectWorldId(subject_kind);
}
