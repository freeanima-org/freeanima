/** 统一测试 harness 的实现已下沉 kernel（各层均可 import）；此处保留服务端入口。 */
export {
  assertTestContextWired,
  createTestContext,
  type TestContext,
  type TestContextOptions,
} from "@freeanima/kernel/testing/create-test-context.ts";
