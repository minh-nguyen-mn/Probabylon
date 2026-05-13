"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "../../components/auth-guard";
import {
  apiDeleteUser,
  apiFetchProposals,
  apiFetchUsers,
  apiModerateProposal,
  apiUpdateUser,
  AuthUser,
} from "../../lib/auth-api";

type Proposal = {
  id: string;
  question: string;
  description: string;
  resolution_criteria: string;
  category: string;
  status: string;
  moderation_notes: string;
  created_at: string;
  expires_at: string;
};

function AdminContent() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pendingProposals = useMemo(
    () => proposals.filter((proposal) => proposal.status === "pending_review"),
    [proposals]
  );
  const reviewedProposals = useMemo(
    () => proposals.filter((proposal) => proposal.status !== "pending_review"),
    [proposals]
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [usersData, proposalsData] = await Promise.all([apiFetchUsers(search), apiFetchProposals()]);
      setUsers(usersData);
      setProposals(proposalsData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function toggleRole(user: AuthUser) {
    setActionLoading(user.id);
    try {
      await apiUpdateUser(user.id, { role: user.role === "admin" ? "user" : "admin" });
      await loadAll();
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleActive(user: AuthUser) {
    setActionLoading(user.id);
    try {
      await apiUpdateUser(user.id, { is_active: !user.is_active });
      await loadAll();
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteUser(user: AuthUser) {
    setActionLoading(user.id);
    try {
      await apiDeleteUser(user.id);
      await loadAll();
    } finally {
      setActionLoading(null);
    }
  }

  async function moderateProposal(proposal: Proposal, status: string) {
    setActionLoading(proposal.id);
    try {
      await apiModerateProposal(proposal.id, { status });
      setProposals((current) =>
        current.map((item) => (item.id === proposal.id ? { ...item, status } : item))
      );
    } catch (err: any) {
      setError(err.message || "Failed to moderate proposal");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Admin Command Center</h1>
          <p className="mt-2 text-zinc-400">Moderate community markets, manage users, and supervise the platform.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Users</div>
            <div className="mt-2 text-3xl font-semibold">{users.length}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Admins</div>
            <div className="mt-2 text-3xl font-semibold text-amber-300">{users.filter((user) => user.role === "admin").length}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pending proposals</div>
            <div className="mt-2 text-3xl font-semibold text-cyan-300">{pendingProposals.length}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Reviewed</div>
            <div className="mt-2 text-3xl font-semibold text-rose-300">{reviewedProposals.length}</div>
          </div>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users"
              className="min-w-[260px] flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"
            />
            <button onClick={loadAll} className="rounded-full border border-zinc-700 px-4 py-3 text-sm text-zinc-200">
              Refresh
            </button>
          </div>
          {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h2 className="text-xl font-semibold">Moderation queue</h2>
              <p className="mt-1 text-sm text-zinc-400">Only proposals waiting for review stay in this queue.</p>
              <div className="mt-4 space-y-3">
                {!loading && !pendingProposals.length ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                    No pending proposals right now.
                  </div>
                ) : null}
                {(loading ? [] : pendingProposals).map((proposal) => (
                  <div key={proposal.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{proposal.question}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                          {proposal.category} | {proposal.status}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">{new Date(proposal.created_at).toLocaleDateString()}</div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">{proposal.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        disabled={actionLoading === proposal.id}
                        onClick={() => moderateProposal(proposal, "approved")}
                        className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionLoading === proposal.id}
                        onClick={() => moderateProposal(proposal, "rejected")}
                        className="rounded-full border border-rose-400/40 px-4 py-2 text-sm text-rose-300 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        disabled={actionLoading === proposal.id}
                        onClick={() => moderateProposal(proposal, "archived")}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 disabled:opacity-60"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h2 className="text-xl font-semibold">Recently reviewed</h2>
              <p className="mt-1 text-sm text-zinc-400">Approved, rejected, and archived proposals move here after action.</p>
              <div className="mt-4 space-y-3">
                {!loading && !reviewedProposals.length ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                    No reviewed proposals yet.
                  </div>
                ) : null}
                {(loading ? [] : reviewedProposals.slice(0, 8)).map((proposal) => (
                  <div key={proposal.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                    <div className="font-medium text-white">{proposal.question}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {proposal.category} | {proposal.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-xl font-semibold">User management</h2>
            <div className="mt-4 space-y-3">
              {(loading ? [] : users).map((user) => (
                <div key={user.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{user.name || user.email}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {user.email} | @{user.username || "user"} | {user.role}
                      </div>
                    </div>
                    <div className={`rounded-full px-2 py-1 text-xs ${user.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                      {user.is_active ? "Active" : "Disabled"}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={actionLoading === user.id} onClick={() => toggleRole(user)} className="rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-60">
                      {user.role === "admin" ? "Make user" : "Make admin"}
                    </button>
                    <button disabled={actionLoading === user.id} onClick={() => toggleActive(user)} className="rounded-full border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-60">
                      {user.is_active ? "Disable" : "Enable"}
                    </button>
                    <button disabled={actionLoading === user.id} onClick={() => deleteUser(user)} className="rounded-full border border-rose-400/40 px-3 py-2 text-sm text-rose-300 disabled:opacity-60">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminContent />
    </AuthGuard>
  );
}
