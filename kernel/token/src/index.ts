/** Qualified identity token; created only via {@link createQualifiedToken} */
export abstract class QualifiedToken<Payload> {
  /** @internal carries Payload generic; unused at runtime */
  declare protected readonly _payloadBrand?: Payload;

  readonly id: symbol;
  readonly qualifiedId: string;
  readonly description?: string;

  protected constructor(qualifiedId: string, description?: string) {
    this.id = Symbol(qualifiedId);
    this.qualifiedId = qualifiedId;
    if (description !== undefined) {
      this.description = description;
    }
  }
}

class QualifiedTokenImpl<Payload> extends QualifiedToken<Payload> {
  constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

/** Create qualified token; qualifiedId is unique id; description for display/docs only */
export function createQualifiedToken<Payload>(
  qualifiedId: string,
  description?: string,
): QualifiedToken<Payload> {
  return new QualifiedTokenImpl(qualifiedId, description);
}

export type PayloadOf<T> = T extends QualifiedToken<infer P> ? P : never;

/** Error message for logging (unknown-safe) */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
