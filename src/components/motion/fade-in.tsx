"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function FadeIn({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
      whileInView={reducedMotion ? undefined : { y: [8, 0], opacity: [0.8, 1] }}
      viewport={{ once: true }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}
