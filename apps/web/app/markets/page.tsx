"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { CategoryCard, MarketCard, SectionHeader, StatCard } from "../../components/platform";
import { getExploreMarkets } from "../../lib/api";
import { ExplorePayload } from "../../lib/types";

const SORTS = [
  ["trending", "Đang nóng"],
  ["newest", "Mới nhất"],
  ["highest_volume", "Khối lượng cao nhất"],
  ["highest_volatility", "Biến động cao nhất"],
  ["ending_soon", "Sắp kết thúc"],
  ["controversial", "Gây tranh cãi"],
  ["resolved", "Vừa kết thúc"],
] as const;

function MarketsContent() {
  const [payload, setPayload] = useState<ExplorePayload | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("trending");
  const [category, setCategory] = useState("");

  useEffect(() => {
    getExploreMarkets({ search, sort, category }).then(setPayload).catch(console.error);
  }, [search, sort, category]);

  const categories = useMemo(() => payload?.categories || [], [payload]);

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Đang tải trang khám phá thị trường...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader
          eyebrow="Thị trường"
          title="Khám phá lớp dự báo công khai"
          description="Lọc theo chủ đề, biến động, khối lượng, thời gian hoặc mức tranh cãi để tìm ra các thị trường tín hiệu cao nhất."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Chỉ số bất định" value={payload.stats.uncertainty_index.toFixed(1)} />
          <StatCard label="Độ ổn định đồng thuận" value={`${payload.stats.consensus_stability.toFixed(1)}%`} tone="emerald" />
          <StatCard label="Chất lượng hiệu chỉnh" value={`${payload.stats.calibration_quality.toFixed(1)}%`} tone="cyan" />
          <StatCard label="Tâm lý thị trường" value={`${payload.stats.market_sentiment.toFixed(1)}%`} tone="amber" />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm thị trường, câu chuyện hoặc chủ đề"
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white">
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white">
              <option value="">Tất cả chủ đề</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <SectionHeader title="Dòng thị trường" description={`${payload.markets.length} thị trường công khai đang hiển thị`} />
            <div className="grid gap-4 md:grid-cols-2">
              {payload.markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeader title="Bản đồ chủ đề" description="Những lĩnh vực đang hoạt động sôi động nhất lúc này." />
            <div className="space-y-3">
              {payload.categories.slice(0, 6).map((item) => (
                <CategoryCard key={item.slug} category={item} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function MarketsPage() {
  return (
    <AuthGuard>
      <MarketsContent />
    </AuthGuard>
  );
}
