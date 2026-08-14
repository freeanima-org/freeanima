/** HTTP-01 challenge token → keyAuthorization（内存；续期时复用同一 store） */

const challenges = new Map<string, string>();

export function setHttp01Challenge(token: string, keyAuthorization: string): void {
  challenges.set(token, keyAuthorization);
}

export function getHttp01Challenge(token: string): string | undefined {
  return challenges.get(token);
}

export function removeHttp01Challenge(token: string): void {
  challenges.delete(token);
}

export function clearHttp01Challenges(): void {
  challenges.clear();
}

/** 仅测试用 */
export function http01ChallengeCount(): number {
  return challenges.size;
}
