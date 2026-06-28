declare module "@node-rs/jieba" {
  export class Jieba {
    static withDict(dict: Uint8Array): Jieba;
    loadDict(data: Buffer): void;
    cut(text: string, hmm: boolean): string[];
  }
}

declare module "@node-rs/jieba/dict" {
  export const dict: Uint8Array;
}
