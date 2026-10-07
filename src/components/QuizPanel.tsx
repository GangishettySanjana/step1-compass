"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface QuizQuestion {
  topic: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

type LoadState = "idle" | "loading" | "ready" | "error" | "empty";

export function QuizPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LoadState>("idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch("/api/quiz/generate");
      const data = await res.json();
      setPeriod({ start: data.periodStart, end: data.periodEnd });
      if (!data.questions || data.questions.length === 0) {
        setState("empty");
        return;
      }
      setQuestions(data.questions);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  async function submit() {
    const payload = {
      periodStart: period.start,
      periodEnd: period.end,
      topics: [...new Set(questions.map((q) => q.topic))],
      answers: questions.map((q, i) => ({
        topic: q.topic,
        correct: answers[i] === q.correctIndex,
      })),
    };
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setResult({ score: data.score, total: data.total });
    setSubmitted(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Self-check quiz
        </h2>
        <button onClick={onClose} className="text-xs" style={{ color: "var(--muted)" }}>
          Close
        </button>
      </div>

      {state === "idle" && (
        <div>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            A quick self-check on what you&apos;ve studied recently. Not a replacement for your
            UWorld/NBME practice.
          </p>
          <button
            onClick={load}
            className="text-sm px-4 py-2 rounded-full"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Generate quiz
          </button>
        </div>
      )}

      {state === "loading" && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Writing questions…
        </p>
      )}

      {state === "empty" && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No topics completed in this window yet. Finish a few topics first.
        </p>
      )}

      {state === "error" && (
        <p className="text-sm" style={{ color: "var(--rose)" }}>
          Couldn&apos;t generate a quiz right now. Try again shortly.
        </p>
      )}

      {state === "ready" && !submitted && (
        <div className="space-y-5">
          {questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm mb-2" style={{ color: "var(--foreground)" }}>
                {i + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.choices.map((c, ci) => (
                  <button
                    key={ci}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: ci }))}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg"
                    style={{
                      background:
                        answers[i] === ci ? "var(--accent-soft)" : "var(--surface-muted)",
                      color: answers[i] === ci ? "var(--accent)" : "var(--foreground)",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submit}
            disabled={Object.keys(answers).length < questions.length}
            className="text-sm px-4 py-2 rounded-full disabled:opacity-40"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Submit
          </button>
        </div>
      )}

      {submitted && result && (
        <div>
          <p className="text-lg mb-3" style={{ color: "var(--foreground)" }}>
            {result.score} / {result.total}
          </p>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <p key={i} className="text-xs" style={{ color: "var(--muted)" }}>
                <span style={{ color: answers[i] === q.correctIndex ? "var(--accent)" : "var(--rose)" }}>
                  {answers[i] === q.correctIndex ? "Correct:" : "Missed:"}
                </span>{" "}
                {q.explanation}
              </p>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
