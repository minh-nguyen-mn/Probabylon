"use client";

import Link from "next/link";

import { AgentRow, CategorySnapshot, MarketRow, UserSummary } from "../lib/types";

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Đang mở",
    running: "Đang chạy",
    resolved: "Đã kết thúc",
    archived: "Đã lưu trữ",
    approved: "Đã duyệt",
    rejected: "Đã từ chối",
    pending_review: "Chờ duyệt",
  };
  return map[status] || status;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">{eyebrow}</p> : null}
        <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm text-zinc-400">{description}</p> : null}
      </div>
      {href && cta ? (
        <Link href={href} className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-emerald-400 hover:text-white">
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "amber" | "cyan";
  hint?: string;
}) {
  const tones = {
    default: "from-zinc-900 to-zinc-950 border-zinc-800",
    emerald: "from-emerald-950/70 to-zinc-950 border-emerald-500/20",
    amber: "from-amber-950/60 to-zinc-950 border-amber-500/20",
    cyan: "from-cyan-950/60 to-zinc-950 border-cyan-500/20",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-2 text-sm text-zinc-400">{hint}</div> : null}
    </div>
  );
}

export function MarketCard({ market, compact = false }: { market: MarketRow; compact?: boolean }) {
  const pct = Math.round(market.probability * 100);
  return (
    <Link
      href={`/markets/${market.id}`}
      className={`group rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 transition hover:border-emerald-400/60 hover:bg-zinc-900 ${compact ? "" : "min-h-[220px]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              {market.category}
            </span>
            {market.is_featured ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-300">
                Nổi bật
              </span>
            ) : null}
            {market.is_pinned ? (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300">
                Ghim
              </span>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold text-white group-hover:text-emerald-200">{market.question}</h3>
          {market.description ? <p className="line-clamp-2 text-sm text-zinc-400">{market.description}</p> : null}
        </div>
        <div className={`rounded-full border px-2 py-1 text-xs ${market.status === "running" ? "border-cyan-500/40 text-cyan-300" : "border-zinc-700 text-zinc-400"}`}>
          {statusLabel(market.status)}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Xác suất</div>
          <div className="mt-2 text-4xl font-semibold text-white">{pct}%</div>
        </div>
        <div className={`text-sm ${market.momentum >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {market.momentum >= 0 ? "Động lượng tăng" : "Động lượng giảm"} {Math.abs(market.momentum * 100).toFixed(1)} điểm
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-300 md:grid-cols-4">
        <div>
          <div className="text-zinc-500">Khối lượng</div>
          <div>{market.volume.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Biến động</div>
          <div>{market.volatility.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Độ tin cậy</div>
          <div>{Math.round((market.confidence ?? 0.5) * 100)}%</div>
        </div>
        <div>
          <div className="text-zinc-500">Hoạt động</div>
          <div>{market.activity ?? 0}</div>
        </div>
      </div>

      {market.narratives?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {market.narratives.map((narrative) => (
            <span key={narrative} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
              {narrative}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function CategoryCard({ category }: { category: CategorySnapshot }) {
  return (
    <Link href={`/categories/${category.slug}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 transition hover:border-cyan-400/50">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{category.name}</h3>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">{category.market_count} thị trường</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-zinc-500">Tâm lý</div>
          <div className="text-zinc-200">{category.sentiment}</div>
        </div>
        <div>
          <div className="text-zinc-500">Xác suất TB</div>
          <div className="text-zinc-200">{(category.avg_probability * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-zinc-500">Khối lượng</div>
          <div className="text-zinc-200">{category.volume.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Biến động</div>
          <div className="text-zinc-200">{category.volatility.toFixed(3)}</div>
        </div>
      </div>
    </Link>
  );
}

export function AgentMiniCard({ agent }: { agent: AgentRow }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{agent.persona}</h3>
          <p className="mt-1 text-sm text-zinc-400">{agent.specialization || agent.archetype || "Tác nhân liên thị trường"}</p>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{agent.archetype || "Thích ứng"}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Metric label="Vốn" value={agent.capital.toFixed(1)} />
        <Metric label="Uy tín" value={agent.reputation.toFixed(2)} />
        <Metric label="Hiệu chỉnh" value={agent.calibration_score.toFixed(2)} />
      </div>
    </div>
  );
}

export function UserLeaderboard({ users }: { users: UserSummary[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      <h3 className="text-lg font-semibold text-white">Người dùng nổi bật</h3>
      <div className="mt-4 space-y-3">
        {users.map((user, index) => (
          <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">{index + 1}</span>
              <div>
                <div className="font-medium text-white">{user.name}</div>
                <div className="text-xs text-zinc-500">{user.submitted_markets} đề xuất | {user.forecast_count} dự báo</div>
              </div>
            </div>
            <div className="text-emerald-300">{Math.round(user.reputation * 100)} điểm</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="text-zinc-200">{value}</div>
    </div>
  );
}
