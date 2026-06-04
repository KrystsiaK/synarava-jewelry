"use client";

import { useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function MagneticButton({
  children,
  className,
  href,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 350, damping: 28 });
  const sy = useSpring(y, { stiffness: 350, damping: 28 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      x.set((e.clientX - (r.left + r.width / 2)) * 0.28);
      y.set((e.clientY - (r.top + r.height / 2)) * 0.28);
    },
    [x, y],
  );

  const reset = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const shared = {
    ref: ref as React.Ref<never>,
    className,
    style: { x: sx, y: sy },
    onMouseMove: handleMouseMove,
    onMouseLeave: reset,
    whileTap: { scale: 0.96 as number },
  };

  if (href) {
    return (
      <motion.a href={href} {...shared}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type="button" onClick={onClick} {...shared}>
      {children}
    </motion.button>
  );
}