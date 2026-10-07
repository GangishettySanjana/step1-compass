"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { useState } from "react";
import type { TopicRow } from "@/lib/schedule";

const DIFFICULTY_LABEL: Record<TopicRow["difficulty"], string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  very_hard: "Very hard · high-yield",
};

const DIFFICULTY_STYLE: Record<TopicRow["difficulty"], { bg: string; fg: string }> = {
  easy: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  moderate: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  hard: { bg: "var(--coral-soft)", fg: "var(--coral)" },
  very_hard: { bg: "var(--rose-soft)", fg: "var(--rose)" },
};

export function TaskCard({
  topic,
  onComplete,
  onSwap,
}: {
  topic: TopicRow;
  onComplete: (id: number, note: string) => void;
  onSwap: (id: number) => void;
}) {
  const done = topic.status === "done";
  const style = DIFFICULTY_STYLE[topic.difficulty];
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState("");

  function confirmDone() {
    onComplete(topic.id, note.trim());
    setNoteMode(false);
    setNote("");
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface)",
        opacity: done ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-block text-[11px] px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: style.bg, color: style.fg }}
          >
            {DIFFICULTY_LABEL[topic.difficulty]}
          </span>
          <p
            className="text-base leading-snug"
            style={{
              color: "var(--foreground)",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {topic.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {topic.system}
          </p>
          {done && topic.notes && (
            <p className="text-xs mt-1.5 italic" style={{ color: "var(--muted)" }}>
              &ldquo;{topic.notes}&rdquo;
            </p>
          )}
        </div>

        {done && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="shrink-0 rounded-full p-2"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Check size={18} />
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!done && !noteMode && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 mt-3 overflow-hidden"
          >
            <button
              onClick={() => onSwap(topic.id)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
            >
              <Clock size={15} />
              Skip to tomorrow
            </button>
            <button
              onClick={() => setNoteMode(true)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Check size={15} />
              Done
            </button>
          </motion.div>
        )}

        {!done && noteMode && (
          <motion.div
            key="note"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you cover? (optional, helps make better quiz questions)"
              rows={2}
              className="w-full text-sm rounded-xl p-3 resize-none"
              style={{
                background: "var(--surface-muted)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setNoteMode(false);
                  setNote("");
                }}
                className="flex-1 rounded-full py-2 text-sm font-medium"
                style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDone}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <Check size={15} />
                Mark done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
