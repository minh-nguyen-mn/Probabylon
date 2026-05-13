"use client";

import { FormEvent, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { MarketCard, SectionHeader, StatCard } from "../../components/platform";
import { askForecast } from "../../lib/api";
import { ForecastResult } from "../../lib/types";

function AskContent() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("ai");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await askForecast({ question, category, context }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo dự báo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionHeader
          eyebrow="Dự báo riêng tư"
          title="Hỏi AI oracle dự báo"
          description="Đặt bất kỳ câu hỏi nào hướng về tương lai và nhận xác suất tổng hợp từ nhiều tác nhân AI mà không cần tạo thị trường công khai."
        />

        <form onSubmit={onSubmit} className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="grid gap-4">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="AGI có xuất hiện trước năm 2035 không?" className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-lg text-white" />
            <div className="grid gap-4 md:grid-cols-[0.4fr_1fr]">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white">
                <option value="ai">AI</option>
                <option value="finance">Tài chính</option>
                <option value="technology">Công nghệ</option>
                <option value="science">Khoa học</option>
                <option value="society">Xã hội</option>
                <option value="absurdity">Phi lý</option>
              </select>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Bối cảnh, giả định hoặc ràng buộc bổ sung cho dự báo." className="min-h-28 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
            </div>
            <button disabled={loading || !question.trim()} className="rounded-full bg-emerald-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60">
              {loading ? "Đang tạo dự báo..." : "Tạo dự báo riêng tư"}
            </button>
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
          </div>
        </form>

        {result ? (
          <div className="space-y-6">
            <section className="grid gap-3 md:grid-cols-3">
              <StatCard label="Xác suất" value={`${Math.round(result.probability * 100)}%`} tone="emerald" />
              <StatCard label="Độ tin cậy" value={`${Math.round(result.confidence * 100)}%`} tone="cyan" />
              <StatCard label="Mức bất đồng" value={`${Math.round((1 - result.confidence) * 100)}%`} tone="amber" />
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <SectionHeader title="Tổng hợp lập luận" description={result.summary} />
              <div className="mt-5 grid gap-6 xl:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Các yếu tố bất định chính</h3>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    {result.key_uncertainty_drivers.map((item) => (
                      <li key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Mức bất đồng giữa các tác nhân</h3>
                  <p className="mt-3 text-sm text-zinc-300">{result.disagreement_summary}</p>
                  <div className="mt-4 space-y-3">
                    {result.agent_views.map((view) => (
                      <div key={view.agent_id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{view.persona}</div>
                          <div className={view.probability >= 0.5 ? "text-emerald-300" : "text-rose-300"}>{Math.round(view.probability * 100)}%</div>
                        </div>
                        <div className="mt-2 text-sm text-zinc-400">{view.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader title="Các thị trường liên quan" description="Những thị trường công khai có thể bổ trợ hoặc kiểm tra lại dự báo riêng tư này." />
              <div className="grid gap-4 md:grid-cols-2">
                {result.related_markets.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function AskPage() {
  return (
    <AuthGuard>
      <AskContent />
    </AuthGuard>
  );
}
