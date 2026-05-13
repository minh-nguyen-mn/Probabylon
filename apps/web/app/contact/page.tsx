"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSubmitted(true);
    form.reset();
  }
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-4xl font-semibold">Liên hệ</h1>
        <p className="text-zinc-400">Gửi phản hồi, báo lỗi, đề xuất hợp tác hoặc thắc mắc về kiểm duyệt.</p>
        <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <input required placeholder="Email của bạn" className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          <input required placeholder="Chủ đề" className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          <textarea required placeholder="Nội dung" className="min-h-36 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white" />
          <button className="rounded-full bg-emerald-400 px-5 py-3 font-semibold text-zinc-950">Gửi phản hồi</button>
          {submitted ? <div className="text-sm text-emerald-300">Phản hồi đã được lưu cục bộ trong bản demo này.</div> : null}
        </form>
      </div>
    </main>
  );
}
