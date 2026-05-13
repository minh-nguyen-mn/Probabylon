"use client";

import { FormEvent, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { SectionHeader } from "../../components/platform";
import { submitMarketProposal } from "../../lib/api";

function SubmitContent() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const result = await submitMarketProposal({
        question: String(fd.get("question") || ""),
        description: String(fd.get("description") || ""),
        resolution_criteria: String(fd.get("resolution_criteria") || ""),
        category: String(fd.get("category") || "general"),
        expires_at: String(fd.get("expires_at") || ""),
      });
      setStatus(result.message);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi đề xuất");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionHeader
          eyebrow="Danh sách kiểm duyệt"
          title="Gửi đề xuất thị trường công khai"
          description="Các thị trường do cộng đồng đề xuất sẽ đi vào hàng chờ kiểm duyệt. Quản trị viên có thể duyệt, chỉnh sửa, gộp trùng, từ chối hoặc lưu trữ trước khi công khai."
        />
        <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <input name="question" required placeholder="Câu hỏi thị trường" className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          <div className="grid gap-4 md:grid-cols-2">
            <input name="category" required placeholder="Chủ đề" className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
            <input name="expires_at" type="datetime-local" required className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <textarea name="description" required placeholder="Vì sao thị trường này nên tồn tại?" className="min-h-28 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          <textarea name="resolution_criteria" required placeholder="Tiêu chí xác định kết quả của thị trường là gì?" className="min-h-28 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          <button disabled={loading} className="rounded-full bg-emerald-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60">
            {loading ? "Đang gửi..." : "Gửi để kiểm duyệt"}
          </button>
          {status ? <div className="text-sm text-emerald-300">{status}</div> : null}
          {error ? <div className="text-sm text-red-300">{error}</div> : null}
        </form>
      </div>
    </main>
  );
}

export default function SubmitPage() {
  return (
    <AuthGuard>
      <SubmitContent />
    </AuthGuard>
  );
}
