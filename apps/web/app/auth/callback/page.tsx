"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuthStore } from "../../../lib/auth-store";

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    const status = params.get("status");

    if (status !== "success") {
      router.replace("/login?oauth=error");
      return;
    }

    void hydrate().then(() => {
      router.replace("/");
    });
  }, [hydrate, params, router]);

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-300">
      Completing sign-in...
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-300">
          Loading...
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}