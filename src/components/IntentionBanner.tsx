"use client";

import { motion } from "framer-motion";

export function IntentionBanner({ text }: { text: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl px-6 py-5"
      style={{ background: "var(--accent-soft)" }}
    >
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--accent)" }}>
        Today&apos;s intention
      </p>
      <p className="text-lg leading-relaxed" style={{ color: "var(--foreground)" }}>
        {text ?? "Loading today's focus…"}
      </p>
    </motion.div>
  );
}
