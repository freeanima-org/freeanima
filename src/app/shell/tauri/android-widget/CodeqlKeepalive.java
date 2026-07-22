package org.freeanima.app.widget;

/**
 * CodeQL / Code Quality 在启用 java-kotlin 语言时需要可抽取源码。 Capacitor Android
 * 移除后仅剩文档化的小组件占位；此类供分析器识别，无运行时引用。
 */
public final class CodeqlKeepalive {
  private CodeqlKeepalive() {}

  public static String projectId() {
    return "freeanima";
  }
}
