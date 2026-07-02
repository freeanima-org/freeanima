export function listCredentialMetas() {
  return {
    deprecated: true,
    message: "pass credentials removed; use Shell /vault",
    credentials: [] as const,
  };
}

export function getCredentialDetailHandler(_path: string) {
  throw new Error("pass credentials removed; use Shell /vault");
}
