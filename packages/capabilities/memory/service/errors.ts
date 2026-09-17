/** MemoryService 方法尚未在本部署实现 */
export class MemoryMethodNotImplementedError extends Error {
  override readonly name = "MemoryMethodNotImplementedError";
  constructor(
    readonly method: string,
    readonly deployment: string = "embedded",
  ) {
    super(`MemoryService.${method} is not implemented (deployment=${deployment})`);
  }
}

/** retain / remember 缺 conversation provenance */
export class MemoryProvenanceRequiredError extends Error {
  override readonly name = "MemoryProvenanceRequiredError";
  constructor(readonly method: string) {
    super(`MemoryService.${method} requires source.conversation_id (provenance)`);
  }
}
