import { useCallback, useLayoutEffect, useState, type RefCallback } from "react";

/** 观察元素 content box 宽度（ResizeObserver + 首帧 layout 测量） */
export function useObservedWidth(): [RefCallback<HTMLElement>, number] {
  const [width, setWidth] = useState(0);
  const [node, setNode] = useState<HTMLElement | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useLayoutEffect(() => {
    if (node) {
      const measure = () => {
        const next = node.getBoundingClientRect().width;
        setWidth(next > 0 ? Math.round(next) : 0);
      };

      measure();
      const ro = new ResizeObserver(() => measure());
      ro.observe(node);
      return () => ro.disconnect();
    }

    setWidth(0);
    return () => {};
  }, [node]);

  return [ref, width];
}
