declare module "@node-rs/jieba" {
  export type TaggedWord = {
    tag: string;
    word: string;
  };

  export class Jieba {
    static withDict(dict: Uint8Array): Jieba;
    loadDict(data: Buffer): void;
    cut(text: string, hmm: boolean): string[];
    tag(sentence: string | Uint8Array, hmm?: boolean | null): TaggedWord[];
  }
}

declare module "@node-rs/jieba/dict" {
  export const dict: Uint8Array;
}

/** Bun `import … with { type: "file" }` → 嵌入文件路径（standalone 下为 /$bunfs/…） */
declare module "@node-rs/jieba/dict.txt" {
  const path: string;
  export default path;
}
