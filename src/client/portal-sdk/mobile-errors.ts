export class UnsupportedMobileError extends Error {
  constructor(appId: string) {
    super(`${appId} 不支持移动端导出`);
    this.name = "UnsupportedMobileError";
  }
}
