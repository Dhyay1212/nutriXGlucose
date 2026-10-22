"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentUserId, listUsers, saveUser, setCurrentUserId, storageMode } from "@/lib/store";
import { seedDemoWeek } from "@/lib/demo";
import type { UserProfile } from "@/lib/types";

interface Ctx {
  user: UserProfile | null;
  users: UserProfile[];
  switchUser: (id: string) => void;
  refreshUsers: () => Promise<void>;
}
const UserCtx = createContext<Ctx>({ user: null, users: [], switchUser: () => {}, refreshUsers: async () => {} });
export const useUser = () => useContext(UserCtx);

export default function UserProvider({ children, allowAnonymous = false }: { children: React.ReactNode; allowAnonymous?: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      setUsers(await listUsers());
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    setCurrentId(getCurrentUserId());
    refreshUsers().finally(() => setReady(true));
  }, [refreshUsers]);

  const switchUser = (id: string) => {
    setCurrentUserId(id);
    setCurrentId(id);
  };

  const user = users.find((u) => u.id === currentId) ?? null;

  if (!ready) return <main className="wrap"><p className="muted">Loading…</p></main>;
  if (err) return <main className="wrap"><div className="card error">Could not load data: {err}</div></main>;
  if (!user && !allowAnonymous)
    return <Onboard users={users} onDone={async (id) => { await refreshUsers(); switchUser(id); }} />;

  return <UserCtx.Provider value={{ user, users, switchUser, refreshUsers }}>{children}</UserCtx.Provider>;
}

function Onboard({ users, onDone }: { users: UserProfile[]; onDone: (id: string) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="wrap">
      <div className="card">
        <h1>Welcome to NutriX Glucose</h1>
        <p className="muted">Snap your meal, add your glucose readings, and see how your own meals affect you.</p>
        {users.length > 0 && (
          <>
            <h3>Continue as</h3>
            <div className="chips">
              {users.map((u) => (
                <button key={u.id} className="chip" onClick={() => onDone(u.id)}>{u.id} · {u.name}</button>
              ))}
            </div>
            <hr />
          </>
        )}
        <h3>New participant</h3>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!id.trim() || !name.trim()) return;
            setBusy(true);
            await saveUser({ id: id.trim().toUpperCase(), name: name.trim() });
            onDone(id.trim().toUpperCase());
          }}
        >
          <label>Pilot ID<input value={id} onChange={(e) => setId(e.target.value)} placeholder="P01" required /></label>
          <label>First name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha" required /></label>
          <button className="btn" disabled={busy}>Start</button>
        </form>
        <hr />
        <button className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); onDone(await seedDemoWeek()); }}>
          Try it with a sample week
        </button>
        <p className="tiny muted">Data is saved {storageMode === "supabase" ? "to the NutriX Supabase database" : "in this browser only (Supabase not connected)"}.</p>
      </div>
    </main>
  );
}
