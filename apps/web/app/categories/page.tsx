"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import { CategoryCard, SectionHeader } from "../../components/platform";
import { getCategories } from "../../lib/api";
import { CategorySnapshot } from "../../lib/types";

function CategoriesContent() {
  const [categories, setCategories] = useState<CategorySnapshot[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getCategories()
      .then((payload) => setCategories(payload.categories))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load categories"));
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionHeader
          eyebrow="Category Atlas"
          title="Explore the forecast universe by domain"
          description="Jump into technology, finance, geopolitics, culture, absurdity, and every other domain where the collective is actively pricing the future."
        />

        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </section>
      </div>
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <AuthGuard>
      <CategoriesContent />
    </AuthGuard>
  );
}
