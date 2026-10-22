"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authEnabled, getAuthUser, getCurrentUserId, listUsers, onAuthChange, saveUser, setCurrentUserId, signInWithEmail, storageMode } from "@/lib/store";
import { seedDemoWeek, DEMO_USER } from "@/lib/demo";
import type { UserProfile } from "@/lib/types";

interface Ctx {
  user: UserProfile | null;
  users: UserProfile[];
  authEmail: string | null;
  switchUser: (id: string) => void;
  refreshUsers: () => Promise<void>;
}
const UserCtx = createContext<Ctx>({ user: null, users: [], authEmail: null, switchUser: () => {}, refreshUsers: async () => {} });
export const useUser = () => useContext(UserCtx);

/** What we collect and why. Shown before anyone logs a meal (P031: health data privacy). */
export function ConsentText() {
  return (
    <ul className="tiny muted" style={{ margin: "6px 0", paddingLeft: 18, lineHeight: 1.6 }}>
      <li><b>What we store:</b> your pilot ID, first name, meal photos (small thumbnails), dishes and portions, glucose readings, meal tags and weekly notes.</li>
      <li><b>Where:</b> {storageMode === "supabase" ? "the NutriX pilot database (Supabase), visible to you and the pilot’s diabetes educator only." : "in this browser only (nothing leaves this device except photo analysis)."}</li>
      <li><b>Photo analysis:</b> a meal photo is first checked by the NutriX detector on your phone, then sent to an AI service (via OpenRouter) to name dishes and estimate nutrition. It is not used by NutriX for anything else.</li>
      <li><b>Not medical advice:</b> numbers are estimates for spotting patterns. Medication and treatment decisions stay with your doctor.</li>
      <li><b>Your control:</b> export or delete all your data at any time from Privacy &amp; data.</li>
    </ul>
  );
}

export default function UserProvider({ children, allowAnonymous = false }: { children: React.ReactNode; allowAnonymous?: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [auth, setAuth] = useState<{ id: string; email?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      setUsers(await listUsers());
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }, []);

  const boot = useCallback(async () => {
    const a = await getAuthUser().catch(() => null);
    setAuth(a);
    if (authEnabled && !a) { setReady(true); return; }
    setCurrentId(getCurrentUserId());
    await refreshUsers();
    setReady(true);
  }, [refreshUsers]);

  useEffect(() => {
    boot();
    return onAuthChange(() => { boot(); });
  }, [boot]);

  const switchUser = (id: string) => {
    setCurrentUserId(id);
    setCurrentId(id);
  };

  // With login on, your own profile is the one linked to your account.
  const own = auth ? users.find((u) => u.authId === auth.id) : null;
  const user = (authEnabled ? users.find((u) => u.id === currentId && (u.authId === auth?.id || own?.role === "educator")) ?? own : users.find((u) => u.id === currentId)) ?? null;

  if (!ready) return <main className="wrap"><p className="muted">Loading…</p></main>;
  if (err) return <main className="wrap"><div className="card error">Could not load data: {err}</div></main>;
  if (authEnabled && !auth) return <Login />;
  if (!user && !allowAnonymous)
    return <Onboard users={authEnabled ? [] : users} authId={auth?.id ?? null} onDone={async (id) => { await refreshUsers(); switchUser(id); }} />;
  if (user && !user.consentAt && !allowAnonymous)
    return <ConsentGate user={user} onDone={async () => { await refreshUsers(); }} />;

  return <UserCtx.Provider value={{ user, users, authEmail: auth?.email ?? null, switchUser, refreshUsers }}>{children}</UserCtx.Provider>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="wrap">
      <div className="card stack">
        <div>
          <h1>Sign in to NutriX Glucose</h1>
          <p className="muted tiny" style={{ margin: 0 }}>We’ll email you a one-time sign-in link. No password needed.</p>
        </div>
        {sent ? (
          <div className="stat flat"><b style={{ fontSize: "1rem" }}>Check your inbox</b><span>Open the link we sent to {email} on this device.</span></div>
        ) : (
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); setErr(null); try { await signInWithEmail(email.trim()); setSent(true); } catch (x: any) { setErr(x.message); } }}>
            <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <button className="btn">Email me a sign-in link</button>
          </form>
        )}
        {err && <p className="tiny" style={{ color: "var(--crit)" }}>{err}</p>}
      </div>
    </main>
  );
}

function ConsentGate({ user, onDone }: { user: UserProfile; onDone: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <main className="wrap">
      <div className="card stack">
        <h1>Before you continue</h1>
        <ConsentText />
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--ink)" }}>
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ marginTop: 4 }} />
          I understand and agree to take part in the NutriX Glucose pilot.
        </label>
        <button className="btn" disabled={!ok} onClick={async () => { await saveUser({ ...user, consentAt: new Date().toISOString() }); onDone(); }}>Continue</button>
      </div>
    </main>
  );
}

function Onboard({ users, authId, onDone }: { users: UserProfile[]; authId: string | null; onDone: (id: string) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="wrap">
      <div className="card">
        <h1>Welcome to NutriX Glucose</h1>
        <p className="muted">Snap your meal, add your glucose readings, and see how <b>your</b> meals affect <b>your</b> glucose.</p>
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
            if (!id.trim() || !name.trim() || !ok) return;
            setBusy(true);
            setErr(null);
            try {
              await saveUser({ id: id.trim().toUpperCase(), name: name.trim(), consentAt: new Date().toISOString(), role: "participant", authId });
              onDone(id.trim().toUpperCase());
            } catch (x: any) { setErr(x.message); setBusy(false); }
          }}
        >
          <label>Pilot ID<input value={id} onChange={(e) => setId(e.target.value)} placeholder="P01" required /></label>
          <label>First name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha" required /></label>
          <div>
            <div className="tiny" style={{ fontWeight: 650 }}>Your data</div>
            <ConsentText />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--ink)" }}>
              <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ marginTop: 4 }} />
              I understand and agree to take part.
            </label>
          </div>
          <button className="btn" disabled={busy || !ok}>Start</button>
          {err && <p className="tiny" style={{ color: "var(--crit)" }}>{err}</p>}
        </form>
        {!authEnabled && (
          <>
            <hr />
            <button className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); onDone(await seedDemoWeek()); }}>
              Try it with sample data ({DEMO_USER.name.replace(" (sample data)", "")}, 30 days)
            </button>
          </>
        )}
        <p className="tiny muted">Data is saved {storageMode === "supabase" ? "to the NutriX pilot database" : "in this browser only"}. <Link href="/privacy">Privacy &amp; data</Link></p>
      </div>
    </main>
  );
}
