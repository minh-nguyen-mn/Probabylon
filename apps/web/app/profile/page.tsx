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
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load your profile."));
  }, []);

  if (error) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-red-300">{error}</main>;
  }

  if (!payload) {
    return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-300">Loading profile...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionHeader
          eyebrow="Profile"
          title={payload.user.name || payload.user.email}
          description="Your forecasting footprint, submission history, and platform reputation in one place."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Reputation" value={`${Math.round(payload.user.reputation * 100)}`} tone="emerald" />
          <StatCard label="Submitted markets" value={String(payload.metrics.submitted_markets)} />
          <StatCard label="Private forecasts" value={String(payload.metrics.private_forecasts)} tone="cyan" />
          <StatCard label="Accuracy score" value={`${Math.round(payload.metrics.accuracy_score * 100)}%`} tone="amber" />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-semibold text-white">Market submissions</h3>
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
                  You have not submitted any public markets yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h3 className="text-lg font-semibold text-white">Forecast history</h3>
            <div className="mt-4 space-y-3">
              {payload.forecast_history.length ? (
                payload.forecast_history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="font-medium text-white">{item.question}</div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {item.category} | {Math.round(item.probability * 100)}% | confidence {Math.round(item.confidence * 100)}%
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                  You do not have any private forecasts yet. Start with a question for the forecast engine.
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
