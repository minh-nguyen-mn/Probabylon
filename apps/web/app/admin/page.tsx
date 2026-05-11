"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "../../components/auth-guard";
import { AuthUser, apiFetchUsers, apiUpdateUser, apiDeleteUser } from "../../lib/auth-api";

function AdminContent() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadUsers(q: string = "") {
    setLoading(true);
    try {
      const data = await apiFetchUsers(q);
      setUsers(data);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSearch() {
    await loadUsers(search);
  }

  async function toggleRole(user: AuthUser) {
    setActionLoading(user.id);
    try {
      const newRole = user.role === "admin" ? "user" : "admin";
      await apiUpdateUser(user.id, { role: newRole });
      await loadUsers(search);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleActive(user: AuthUser) {
    setActionLoading(user.id);
    try {
      await apiUpdateUser(user.id, { is_active: !user.is_active });
      await loadUsers(search);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(user: AuthUser) {
    if (!confirm(`Bạn có chắc muốn xoá user "${user.email}"?`)) return;
    setActionLoading(user.id);
    try {
      await apiDeleteUser(user.id);
      await loadUsers(search);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-600/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quản lý tài khoản</h1>
            <p className="text-zinc-400 text-sm">Quản lý người dùng hệ thống Probabylon</p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 flex gap-3">
          <input
            id="admin-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Tìm theo email hoặc tên..."
            className="flex-1 px-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-all"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-600/20"
          >
            Tìm kiếm
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Tổng users</p>
            <p className="text-2xl font-bold mt-1">{users.length}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Admin</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">{users.filter(u => u.role === "admin").length}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{users.filter(u => u.is_active).length}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider">Disabled</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{users.filter(u => !u.is_active).length}</p>
          </div>
        </div>

        {/* Users table */}
        <div className="mt-6 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">User</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Trạng thái</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Đăng nhập</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ngày tạo</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-zinc-400">Đang tải...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                      Không tìm thấy user nào
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-800/20 transition-colors">
                      {/* User info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.name || "—"}</p>
                            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          user.role === "admin"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                            : "bg-zinc-700/40 text-zinc-300 border border-zinc-600/20"
                        }`}>
                          {user.role === "admin" ? "👑 Admin" : "User"}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
                          {user.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      {/* Login type */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-zinc-400">
                          {user.google_id ? "🔗 Google" : "📧 Email"}
                        </span>
                      </td>
                      {/* Created */}
                      <td className="px-5 py-4 text-xs text-zinc-400">
                        {new Date(user.created_at).toLocaleDateString("vi-VN")}
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleRole(user)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 transition-all disabled:opacity-50"
                            title={user.role === "admin" ? "Chuyển thành User" : "Chuyển thành Admin"}
                          >
                            {user.role === "admin" ? "→ User" : "→ Admin"}
                          </button>
                          <button
                            onClick={() => toggleActive(user)}
                            disabled={actionLoading === user.id}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-50 ${
                              user.is_active
                                ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {user.is_active ? "Vô hiệu" : "Kích hoạt"}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all disabled:opacity-50"
                          >
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <a href="/" className="text-zinc-400 hover:text-white text-sm transition-colors">
            ← Quay lại Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminContent />
    </AuthGuard>
  );
}
