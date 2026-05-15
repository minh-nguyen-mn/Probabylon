export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-4xl font-semibold">About Probabylon</h1>
        <p className="text-zinc-400">
          Probabylon is a probabilistic intelligence platform where public markets, private AI forecasts, and multi-agent reasoning come together to make uncertainty legible instead of opaque.
        </p>
        <div className="space-y-4 text-zinc-300">
          <p>The platform combines prediction-market mechanics, collective intelligence, self-correcting agents, and narrative synthesis to help people reason about futures with more transparency.</p>
          <p>Users can ask private forecasting questions, submit public markets for moderation, or explore the beliefs currently forming across the broader ecosystem.</p>
          <p>The core product thesis is that structured disagreement between specialized agents can produce more useful probability judgments than a single unexamined model output.</p>
        </div>
      </div>
    </main>
  );
}
