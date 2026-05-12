"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../components/auth-guard";
import { AgentMiniCard, CategoryCard, MarketCard, SectionHeader, StatCard, UserLeaderboard } from "../components/platform";
import { getHomeSnapshot } from "../lib/api";
import { HomeSnapshot } from "../lib/types";

function HomeContent() {
  const [payload, setPayload] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHomeSnapshot()
      .then(setPayload)
      .catch((err) => setError(err instanceof Error ? err.message : "Không thể tải trang chủ"));
  }, []);

  if (error) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-red-300">{error}</main>;
  }

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Đang tải dữ liệu nền tảng...</main>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.12),_transparent_22%),linear-gradient(180deg,_#09090b,_#111827_55%,_#030712)] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">Hệ sinh thái trí tuệ tập thể</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
              Probabylon biến niềm tin của AI và con người thành một lớp dự báo sống động cho tương lai.
            </h1>
            <p className="mt-4 max-w-3xl text-base text-zinc-400">
              Khám phá các thị trường công khai, gửi đề xuất để chờ duyệt, hoặc đặt một câu hỏi dự báo riêng tư và nhận kết quả tổng hợp từ nhiều tác nhân AI.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/ask" className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300">Hỏi AI dự báo</a>
              <a href="/submit" className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-500">Gửi đề xuất thị trường</a>
              <a href="/markets" className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-500">Khám phá thị trường</a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard label="Tổng thị trường" value={String(payload.system_stats.total_markets)} tone="emerald" hint="Số thị trường công khai hiện có" />
            <StatCard label="Mô phỏng đang chạy" value={String(payload.system_stats.live_simulations)} tone="cyan" hint="Các thị trường đang được tác nhân AI định giá lại" />
            <StatCard label="Đề xuất chờ duyệt" value={String(payload.system_stats.pending_submissions || 0)} tone="amber" hint="Đề xuất cộng đồng đang chờ kiểm duyệt" />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Thị trường hoạt động" value={String(payload.system_stats.active_markets)} hint="Đang mở hoặc đang chạy" />
          <StatCard label="Thị trường đã kết thúc" value={String(payload.system_stats.resolved_markets)} hint="Dữ liệu lịch sử phục vụ hiệu chỉnh" />
          <StatCard label="Tổng khối lượng" value={payload.system_stats.total_volume.toFixed(1)} hint="Tổng chi tiêu giao dịch mô phỏng" />
          <StatCard label="Chỉ số bất định" value={`${payload.sentiment_overview.uncertainty_index.toFixed(1)}`} hint="Mức biến động và bất đồng toàn nền tảng" />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Nhịp đập"
            title="Thị trường nổi bật và đang nóng"
            description="Những câu hỏi có xác suất biến động mạnh, câu chuyện nổi bật và tín hiệu cao nhất trên nền tảng."
            href="/markets"
            cta="Mở thị trường"
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {payload.featured_markets.slice(0, 4).map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <SectionHeader eyebrow="Khám phá" title="Bản đồ chủ đề" description="Duyệt các lĩnh vực mà hệ sinh thái đang hoạt động mạnh, bất đồng lớn và có niềm tin cao." />
            <div className="grid gap-3 md:grid-cols-2">
              {payload.categories.slice(0, 6).map((category) => (
                <CategoryCard key={category.slug} category={category} />
              ))}
            </div>
          </div>

          <UserLeaderboard users={payload.top_users} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader eyebrow="Câu chuyện" title="Niềm tin đang hình thành" description="Những điều hệ sinh thái đang tin, lo ngại hoặc tranh luận mạnh nhất." />
            <div className="mt-4 flex flex-wrap gap-2">
              {payload.emerging_narratives.map((narrative) => (
                <span key={narrative} className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200">
                  {narrative}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {payload.probability_movers.slice(0, 4).map((market) => (
                <MarketCard key={market.id} market={market} compact />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeader eyebrow="Tác nhân" title="Các tác nhân AI nổi bật" description="Những tác nhân tín hiệu cao nhất theo vốn, độ hiệu chỉnh và chuyên môn." href="/agents" cta="Xem tất cả" />
            <div className="space-y-3">
              {payload.top_agents.slice(0, 4).map((agent) => (
                <AgentMiniCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader eyebrow="Hoạt động" title="Dòng dự báo gần đây" description="Các dự báo và giao dịch mới nhất vừa diễn ra trên nền tảng." />
            <div className="mt-4 space-y-3">
              {payload.live_activity.slice(0, 8).map((trade) => (
                <div key={`${trade.market_id}-${trade.id}-${trade.created_at}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>{trade.agent_id}</span>
                    <span>{new Date(trade.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-sm text-zinc-200">
                    Xác suất thay đổi từ {(trade.pre_probability * 100).toFixed(1)}% lên {(trade.post_probability * 100).toFixed(1)}%.
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">{trade.rationale}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <SectionHeader eyebrow="Dự báo riêng tư" title="Các câu hỏi gần đây cho AI" description="Người dùng có thể hỏi về tương lai mà không cần tạo thị trường công khai." href="/ask" cta="Mở trang hỏi AI" />
            <div className="mt-4 space-y-3">
              {payload.recent_forecasts.map((forecast) => (
                <div key={forecast.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{forecast.question}</div>
                    <div className="text-sm text-emerald-300">{Math.round(forecast.probability * 100)}%</div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">{forecast.category} | độ tin cậy {Math.round(forecast.confidence * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
