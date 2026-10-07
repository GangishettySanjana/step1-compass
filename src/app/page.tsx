"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { IntentionBanner } from "@/components/IntentionBanner";
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
  const [intention, setIntention] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const quizRef = useRef<HTMLDivElement | null>(null);

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
      const res = await fetch("/api/intention");
      const data = await res.json();
      setIntention(data.text);
    }
    init();
  }, [loadToday, loadProgress]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
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
        setPushStatus("Notifications were blocked — allow them in your browser's site settings to enable.");
      } else {
        setPushStatus("Couldn't enable reminders right now — try again shortly.");
      }
    }
  }

  async function handleComplete(id: number) {
    setTopics((t) => t?.map((x) => (x.id === id ? { ...x, status: "done" } : x)) ?? t);
    await fetch(`/api/topics/${id}/complete`, { method: "POST" });
    loadToday();
    loadProgress();
  }

  async function handleSwap(id: number) {
    const res = await fetch(`/api/topics/${id}/swap`, { method: "POST" });
    const data = await res.json();
    setTopics(data.topics);
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 md:py-12">
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium" style={{ color: "var(--foreground)" }}>
              Step 1 Compass
            </h1>
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
          </div>
          {pushStatus && (
            <p className="text-xs mt-1 text-right" style={{ color: "var(--rose)" }}>
              {pushStatus}
            </p>
          )}
        </header>

        <IntentionBanner text={intention} />
        <ProgressGraph stats={stats} />

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--muted)" }}>
            Today&apos;s tasks
          </h2>

          <div className="space-y-3">
            <AnimatePresence>
              {topics?.map((t) => (
                <TaskCard key={t.id} topic={t} onComplete={handleComplete} onSwap={handleSwap} />
              ))}
            </AnimatePresence>
            {topics?.length === 0 && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Nothing scheduled yet — check back tomorrow.
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
