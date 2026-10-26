import { useEffect, useRef, useState } from "react";

// Hiệu ứng số đếm dần từ giá trị cũ tới giá trị mới (ease-out), dùng cho thẻ số liệu Dashboard.
// Người dùng bật "giảm chuyển động" → hiện ngay giá trị cuối.
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const v = Math.round(start + (target - start) * easeOutCubic(t));
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
