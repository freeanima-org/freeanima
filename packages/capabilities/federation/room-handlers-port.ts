/**
 * 联邦 Room handler 端口。
 *
 * federation 能力不 import room 特性：room 在自己的 Cordis 插件 apply 时
 * 注册实现，federation 在收发联邦帧时按端口取用（未注册则视为不可用）。
 * 参数以 `unknown` 声明（各方法为方法式声明，实现可用更窄的域类型）。
 */
import type { RoomMessagePayload } from "@freeanima/shared/rpc-contract/frames/room.ts";

export type FederationRoomHandlerPort = {
  hubHandleRoomAppend(payload: unknown): Promise<unknown>;
  hubHandleRoomCatchUp(payload: unknown): Promise<unknown>;
  hubHandleRoomSnapshot(payload: unknown): Promise<unknown>;
  hubHandleRoomCreate(payload: unknown): Promise<unknown>;
  satelliteHandleFederationFrame(method: string, payload: unknown): Promise<void>;
  applyFederatedMessageReplica(input: { message: RoomMessagePayload }): Promise<boolean>;
};

let handlers: FederationRoomHandlerPort | null = null;

export function registerFederationRoomHandlers(next: FederationRoomHandlerPort): void {
  handlers = next;
}

export function federationRoomHandlers(): FederationRoomHandlerPort | null {
  return handlers;
}

/** @internal 测试隔离 */
export function resetFederationRoomHandlersForTest(): void {
  handlers = null;
}
