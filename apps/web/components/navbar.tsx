"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../lib/auth-store";
import { useAppStore } from "../lib/store";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/markets", label: "Thị trường" },
  { href: "/categories", label: "Chủ đề" },
  { href: "/ask", label: "Hỏi AI" },
  { href: "/submit", label: "Gửi đề xuất" },
  { href: "/agents", label: "Tác nhân" },
  { href: "/insights", label: "Phân tích" },
  { href: "/trends", label: "Xu hướng" },
];

function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  if (!isAuthenticated || pathname === "/login" || pathname === "/register") return null;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-zinc-950 shadow-lg shadow-emerald-500/20">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold">Probabylon</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Trí tuệ xác suất</div>
            </div>
          </a>

          <div className="hidden flex-wrap items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href="/about"
              className={`rounded-full px-3 py-2 text-sm transition ${pathname === "/about" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
            >
              Giới thiệu
            </a>
            <a
              href="/contact"
              className={`rounded-full px-3 py-2 text-sm transition ${pathname === "/contact" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
            >
              Liên hệ
            </a>
            {isAdmin ? (
              <a
                href="/admin"
                className={`rounded-full px-3 py-2 text-sm transition ${
                  pathname === "/admin" ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:bg-amber-500/10 hover:text-amber-300"
                }`}
              >
                Quản trị
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a href="/profile" className="hidden rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 md:block">
            Hồ sơ
          </a>
          <div className="hidden items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-2 md:flex">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <div className="max-w-[150px] truncate text-sm text-zinc-200">{user?.name || user?.email}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{isAdmin ? "Quản trị" : "Thành viên"}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-400 hover:text-red-300">
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  );
}

function GlobalMarketEvents() {
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const applyTradeEvent = useAppStore((state) => state.applyTradeEvent);
  const setWsState = useAppStore((state) => state.setWsState);

  useEffect(() => {
    if (!isAuthenticated || pathname === "/login" || pathname === "/register") return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/markets";
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | undefined;

    const connect = () => {
      if (disposed) return;
      setWsState("connecting");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!disposed) setWsState("connected");
      };

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          applyTradeEvent(event);
        } catch {
          return;
        }
      };

      ws.onerror = () => {
        if (!disposed) setWsState("disconnected");
      };

      ws.onclose = () => {
        if (disposed) return;
        setWsState("disconnected");
        retry = setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      disposed = true;
      setWsState("disconnected");
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [applyTradeEvent, isAuthenticated, pathname, setWsState]);

  return null;
}

export function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <GlobalMarketEvents />
      <Navbar />
      {children}
    </>
  );
}
