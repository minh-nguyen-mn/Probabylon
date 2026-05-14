"use client";

import { FormEvent, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { apiGoogleLogin, apiLogin } from "../../lib/auth-api";
import { useAuthStore } from "../../lib/auth-store";
import { auth, googleProvider } from "../../lib/firebase";

function LoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState("");
  const [completeData, setCompleteData] = useState({
    username: "",
    name: "",
    password: "",
    confirmPassword: "",
  });
  const { setAuth } = useAuthStore();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await apiLogin(identifier, password);
      setAuth(resp.access_token, resp.user);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!auth || !googleProvider) {
      setError("Vui lòng cấu hình Firebase trong file .env trước khi dùng đăng nhập Google.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken || (await result.user.getIdToken());
      if (!idToken) throw new Error("Không thể lấy ID token từ Google.");

      setGoogleIdToken(idToken);

      try {
        const resp = await apiGoogleLogin(idToken);
        setAuth(resp.access_token, resp.user);
        window.location.href = "/";
      } catch (err: any) {
        if (err.detail?.code === "NEED_REGISTRATION") {
          setShowCompleteProfile(true);
          setCompleteData((prev) => ({
            ...prev,
            name: err.detail.name || "",
            username: err.detail.email?.split("@")[0] || "",
          }));
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Bạn đã đóng cửa sổ đăng nhập Google.");
      } else {
        setError(err.message || "Đăng nhập Google thất bại.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteSubmit(e: FormEvent) {
    e.preventDefault();
    if (completeData.password !== completeData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const resp = await apiGoogleLogin(
        googleIdToken,
        completeData.username.trim(),
        completeData.password,
        completeData.name.trim()
      );
      setAuth(resp.access_token, resp.user);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Hoàn tất đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{showCompleteProfile ? "Hoàn tất thông tin" : "Đăng nhập"}</h1>
        <p className="text-zinc-400 text-sm">
          {showCompleteProfile ? "Bổ sung vài thông tin để hoàn tất tài khoản Google." : "Đăng nhập để tiếp tục sử dụng Probabylon."}
        </p>
      </div>

      {searchParams.get("registered") === "1" && !error && !showCompleteProfile ? (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
          Đăng ký thành công. Bạn có thể đăng nhập ngay bây giờ.
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      ) : null}

      {showCompleteProfile ? (
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          <Field label="Tên đăng nhập" value={completeData.username} onChange={(value) => setCompleteData((prev) => ({ ...prev, username: value }))} placeholder="ten_dang_nhap" />
          <Field label="Tên hiển thị" value={completeData.name} onChange={(value) => setCompleteData((prev) => ({ ...prev, name: value }))} placeholder="Nguyễn Văn A" />
          <Field label="Mật khẩu" type="password" value={completeData.password} onChange={(value) => setCompleteData((prev) => ({ ...prev, password: value }))} placeholder="••••••••" />
          <Field label="Nhập lại mật khẩu" type="password" value={completeData.confirmPassword} onChange={(value) => setCompleteData((prev) => ({ ...prev, confirmPassword: value }))} placeholder="••••••••" />
          <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl disabled:opacity-50">
            {loading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
          </button>
          <button type="button" onClick={() => setShowCompleteProfile(false)} className="w-full text-zinc-500 text-sm hover:text-white transition-colors py-2">
            Quay lại
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email hoặc tên đăng nhập" value={identifier} onChange={setIdentifier} placeholder="admin@gmail.com hoặc admin" />
            <Field label="Mật khẩu" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl disabled:opacity-50">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">hoặc</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl flex items-center justify-center gap-3 text-sm font-medium text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Đăng nhập bằng Google
          </button>

          <div className="text-center mt-8">
            <p className="text-zinc-500 text-sm">
              Chưa có tài khoản?{" "}
              <a href="/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                Đăng ký ngay
              </a>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Suspense fallback={<div className="text-white text-center">Đang tải...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all text-white"
        placeholder={placeholder}
      />
    </div>
  );
}