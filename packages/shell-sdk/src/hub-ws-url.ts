/** Hub HTTP origin → SAP WebSocket URL（与 sap-contract 逻辑一致，避免 satellite-sdk 依赖 sap-contract） */
export function resolveHubWsUrl(hubUrl: string): string {
  return hubUrl.replace(/\/$/, "").replace(/^http/, "ws") + "/sap/v1";
}
