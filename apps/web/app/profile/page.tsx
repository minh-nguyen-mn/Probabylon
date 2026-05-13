"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { SectionHeader, StatCard } from "../../components/platform";
import { getProfile } from "../../lib/api";
import { ProfilePayload } from "../../lib/types";

function ProfileContent() {
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getProfile()
      .then(setPayload)
      .catch((err) => setError(err instanceof Error ? err.message : "Không thể tải hồ sơ"));
  }, []);

  if (error) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-red-300">{error}</main>;
  }

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Đang tải hồ sơ...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionHeader
          eyebrow="Hồ sơ"
          title={payload.user.name || payload.user.email}
          description="Dấu ấn dự báo, lịch sử đề xuất và mức uy tín của bạn trên toàn nền tảng."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Uy tín" value={`${Math.round(payload.user.reputation * 100)}`} tone="emerald" />
          <StatCard label="Đề xuất đã gửi" value={String(payload.metrics.submitted_markets)} />
          <StatCard label="Dự báo riêng tư" value={String(payload.metrics.private_forecasts)} tone="cyan" />
          <StatCard label="Điểm chính xác" value={`${Math.round(payload.metrics.accuracy_score * 100)}%`} tone="amber" />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-semibold text-white">Đề xuất thị trường</h3>
            <div className="mt-4 space-y-3">
              {payload.submitted_markets.length ? (
                payload.submitted_markets.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="font-medium text-white">{item.question}</div>
                    <div className="mt-2 text-xs text-zinc-500">{item.category} | {item.status}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                  Bạn chưa gửi đề xuất thị trường công khai nào.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-semibold text-white">Lịch sử dự báo</h3>
            <div className="mt-4 space-y-3">
              {payload.forecast_history.length ? (
                payload.forecast_history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="font-medium text-white">{item.question}</div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {item.category} | {Math.round(item.probability * 100)}% | độ tin cậy {Math.round(item.confidence * 100)}%
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                  Bạn chưa có dự báo riêng tư nào. Hãy bắt đầu bằng một câu hỏi cho AI oracle.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
