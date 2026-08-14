type WithoutUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: Exclude<T[K], undefined>;
};

/** 去掉值为 `undefined` 的键（配合 exactOptionalPropertyTypes） */
export function omitUndefined<T extends Record<string, unknown>>(value: T): WithoutUndefined<T> {
  const out = {} as WithoutUndefined<T>;
  for (const key of Object.keys(value) as (keyof T)[]) {
    const val = value[key];
    if (val !== undefined) {
      (out as Record<string, unknown>)[key as string] = val;
    }
  }
  return out;
}
