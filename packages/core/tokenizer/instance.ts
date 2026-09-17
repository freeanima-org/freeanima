export type TokenizerInstance = {
  repo: string;
  encode: (text: string) => number[];
};

export function createTokenizerFromEncode(
  repo: string,
  encode: (text: string) => number[],
): TokenizerInstance {
  return { repo, encode };
}
