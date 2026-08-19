import { customAlphabet } from "nanoid";

/** 仅字母数字，避免 `_`/`-` 等特殊字符（默认 nanoid 字母表含二者） */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const DEFAULT_SIZE = 21;

const generate = customAlphabet(ALPHABET, DEFAULT_SIZE);

/** 新默认公开/临时随机 id：字母数字、无中横线（默认 21 字符） */
export function randomPublicId(size?: number): string {
  return size == null ? generate() : generate(size);
}
