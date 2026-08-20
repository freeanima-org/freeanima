#!/usr/bin/env bun
/**
 * LoCoMo Eval 入口：先隔离 FREEANIMA_HOME，再加载业务模块。
 * 禁止读写用户 ~/.anima/config.yaml（风巢 #16041）。
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const EVAL_HOME = path.join(REPO_ROOT, ".cache", "locomo", "home");

mkdirSync(EVAL_HOME, { recursive: true });
process.env.FREEANIMA_HOME = EVAL_HOME;

const { main } = await import("./cli.ts");
await main(REPO_ROOT);
