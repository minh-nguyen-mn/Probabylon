"use client";

import { useEffect, useRef } from "react";

import { useAppStore } from "../lib/store";

function directionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "Buying YES" : "Selling YES";
}

export function TradeNotifications() {
  const notifications = useAppStore((state) => state.notifications);
  const dismissNotification = useAppStore((state) => state.dismissNotification);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const notification of notifications) {
      if (timers.current.has(notification.id)) continue;
      const timer = setTimeout(() => {
        dismissNotification(notification.id);
        timers.current.delete(notification.id);
      }, 4200);
      timers.current.set(notification.id, timer);
    }

    return () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();
    };
  }, [dismissNotification, notifications]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md transition-all ${
            notification.direction === "bullish"
              ? "border-emerald-400/40 bg-emerald-950/90 text-emerald-50"
              : "border-rose-400/40 bg-rose-950/90 text-rose-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">{notification.agent_title} just traded</div>
              <div className="mt-1 text-xs opacity-80">
                {directionLabel(notification.direction)} | {(notification.probability * 100).toFixed(1)}%
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notification.id)}
              className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] opacity-80 transition hover:opacity-100"
            >
              x
            </button>
          </div>
          <div className="mt-2 text-xs opacity-75">
            {notification.market_question || notification.market_id} | spend {notification.spend.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}
