type WithoutUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: Exclude<T[K], undefined>;
};

/** 去掉值为 `undefined` 的键（配合 exactOptionalPropertyTypes，避免显式传入 `prop: undefined`） */
export function omitUndefined<T extends Record<string, unknown>>(value: T): WithoutUndefined<T> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      out[key] = val;
    }
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- WithoutUndefined 映射构造边界
  return out as WithoutUndefined<T>;
}
