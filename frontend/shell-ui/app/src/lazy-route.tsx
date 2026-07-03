import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";

function ShellRouteFallback(): JSX.Element {
  return (
    <div className="flex h-full min-h-48 items-center justify-center p-4 text-sm text-muted-foreground">
      加载中…
    </div>
  );
}

function LazyRouteShell<P extends object>({
  Lazy,
  ...props
}: P & { Lazy: LazyExoticComponent<ComponentType<P>> }) {
  return (
    <Suspense fallback={<ShellRouteFallback />}>
      <Lazy {...(props as P)} />
    </Suspense>
  );
}

/** 路由级 lazy 组件：按 tab 切割 satellite / admin 等大模块 */
export function shellLazyRoute<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  const Lazy = lazy(loader);
  return function ShellLazyRoute(props: P) {
    return <LazyRouteShell Lazy={Lazy} {...props} />;
  };
}

/** 从命名导出构造 lazy default */
export function lazyNamedComponent<T extends Record<string, ComponentType<object>>>(
  loader: () => Promise<T>,
  exportName: keyof T & string,
): () => Promise<{ default: ComponentType<object> }> {
  return () => loader().then((mod) => ({ default: mod[exportName] }));
}
