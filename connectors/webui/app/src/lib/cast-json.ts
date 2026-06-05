/** JSON 可序列化值（server fn 返回值约束） */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** server fn 返回值在服务端已 JSON 序列化，此处做类型断言供客户端使用 */
export function castJson<T>(value: JsonValue): T {
  return value as unknown as T;
}
