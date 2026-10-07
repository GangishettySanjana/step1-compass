"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressGraph } from "@/components/ProgressGraph";
import { QuizPanel } from "@/components/QuizPanel";
import { TaskCard } from "@/components/TaskCard";
import type { ProgressStats, TopicRow } from "@/lib/schedule";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function Home() {
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const quizRef = useRef<HTMLDivElement | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showQuiz) {
      quizRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showQuiz]);

  const loadToday = useCallback(async () => {
    const res = await fetch("/api/today");
    const data = await res.json();
    setTopics(data.topics);
  }, []);

  const loadProgress = useCallback(async () => {
    const res = await fetch("/api/progress");
    setStats(await res.json());
  }, []);

  useEffect(() => {
    async function init() {
      await Promise.all([loadToday(), loadProgress()]);
      const res = await fetch("/api/settings/daily-count");
      const data = await res.json();
      setDailyCount(data.effective);
    }
    init();
  }, [loadToday, loadProgress]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  async function enablePush() {
    setPushStatus(null);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("Push notifications aren't supported in this browser.");
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setPushStatus("Reminders aren't set up on this deployment yet (missing a config key).");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushEnabled(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPushStatus("Notifications were blocked. Allow them in your browser's site settings to enable.");
      } else {
        setPushStatus("Couldn't enable reminders right now. Try again shortly.");
      }
    }
  }

  async function handleComplete(id: number, note: string) {
    setTopics(
      (t) => t?.map((x) => (x.id === id ? { ...x, status: "done", notes: note || null } : x)) ?? t
    );
    await fetch(`/api/topics/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    loadToday();
    loadProgress();
  }

  async function handleSwap(id: number) {
    const res = await fetch(`/api/topics/${id}/swap`, { method: "POST" });
    const data = await res.json();
    setTopics(data.topics);
  }

  async function changeDailyCount(delta: number) {
    const next = Math.min(Math.max((dailyCount ?? 3) + delta, 1), 8);
    setDailyCount(next);
    await fetch("/api/settings/daily-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: next }),
    });
    loadToday();
  }

  // Two-tap confirm instead of window.confirm(), which is unreliable (or
  // silently suppressed) inside installed PWAs in standalone display mode.
  function handleResetClick() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      resetTimeoutRef.current = setTimeout(() => setConfirmingReset(false), 4000);
      return;
    }
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    setConfirmingReset(false);
    performReset();
  }

  async function performReset() {
    await fetch("/api/reset", { method: "POST" });
    await Promise.all([loadToday(), loadProgress()]);
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 md:py-12">
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
              Step 1 Compass
            </h1>
            <div className="flex items-center gap-3">
              {!pushEnabled && (
                <button
                  onClick={enablePush}
                  className="text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  Enable reminders
                </button>
              )}
              {pushEnabled && (
                <span className="text-xs" style={{ color: "var(--accent)" }}>
                  Reminders on
                </span>
              )}
              <button
                onClick={handleResetClick}
                className="text-xs font-medium"
                style={{ color: confirmingReset ? "var(--rose)" : "var(--muted)" }}
              >
                {confirmingReset ? "Tap again to confirm" : "Reset progress"}
              </button>
            </div>
          </div>
          {pushStatus && (
            <p className="text-xs mt-1 text-right" style={{ color: "var(--rose)" }}>
              {pushStatus}
            </p>
          )}
        </header>

        <ProgressGraph stats={stats} />

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
              Today&apos;s tasks
            </h2>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
              <span>Topics/day</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeDailyCount(-1)}
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "var(--surface-muted)" }}
                  aria-label="Fewer topics per day"
                >
                  −
                </button>
                <span className="w-4 text-center" style={{ color: "var(--foreground)" }}>
                  {dailyCount ?? "…"}
                </span>
                <button
                  onClick={() => changeDailyCount(1)}
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "var(--surface-muted)" }}
                  aria-label="More topics per day"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {topics?.map((t) => (
                <TaskCard key={t.id} topic={t} onComplete={handleComplete} onSwap={handleSwap} />
              ))}
            </AnimatePresence>
            {topics?.length === 0 && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Nothing scheduled yet. Check back tomorrow.
              </p>
            )}
          </div>
        </section>

        <div ref={quizRef}>
          {!showQuiz && (
            <button
              onClick={() => setShowQuiz(true)}
              className="w-full text-sm font-medium px-4 py-3 rounded-full transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              Take self-check quiz
            </button>
          )}
          {showQuiz && <QuizPanel onClose={() => setShowQuiz(false)} />}
        </div>
      </div>
    </main>
  );
}
