import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { getGetMemberSummaryQueryKey, useGetMemberSummary } from '@workspace/api-client-react';
import { supabase } from '@/lib/supabase';

export type AuthUser = { id: string; email?: string; role: 'admin' | 'superadmin'; fullName: string | null };

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const client = supabase;
    setAuthTokenGetter(async () => (await client.auth.getSession()).data.session?.access_token ?? null);
    let active = true;
    const load = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setUser(null);
        setLoading(false);
        return;
      }
      const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${nextSession.access_token}` } });
      if (!response.ok) {
        setUser(null);
        setError((await response.json().catch(() => ({}))).error ?? 'Your account is not authorized.');
      } else {
        setUser(await response.json());
        setError('');
      }
      setLoading(false);
    };
    void client.auth.getSession().then(({ data }) => load(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => void load(nextSession));
    return () => { active = false; data.subscription.unsubscribe(); setAuthTokenGetter(null); };
  }, []);

  if (loading) return <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">Checking your session…</div>;
  if (!session || !user) return <LoginPage error={error} />;
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

function LoginPage({ error: initialError }: { error: string }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const result = isSignUp
      ? await supabase?.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase?.auth.signInWithPassword({ email, password });
    if (result?.error) setError(result.error.message);
    else if (isSignUp && !result?.data.session) setError('Account created. Check your email to confirm your account, then sign in.');
    setPending(false);
  };
  return <main className="grain grid min-h-[100dvh] place-items-center bg-background px-5 py-10"><div className="w-full max-w-md animate-rise rounded-2xl border border-border bg-card p-7 shadow-[0_20px_60px_rgba(38,69,61,.08)] md:p-9"><div className="mb-8 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><LockKeyhole size={20} /></div><div><p className="font-display text-xl text-primary">Heritage</p><p className="text-[10px] font-bold uppercase tracking-[.17em] text-muted-foreground">Member records</p></div></div><h1 className="font-display text-4xl leading-none">{isSignUp ? 'Create your account.' : 'Welcome back.'}</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{isSignUp ? 'Create an account to access your church member records.' : 'Sign in to access your church member records.'}</p><form onSubmit={submit} className="mt-8 grid gap-4">{isSignUp && <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Full name</span><input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>}<label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Password</span><input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-lg border border-input bg-background/70 px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>{error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}<button disabled={pending} className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">{pending ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create account' : 'Sign in')}<ArrowRight size={16} /></button></form><button type="button" onClick={() => { setIsSignUp((current) => !current); setError(''); }} className="mt-5 w-full text-center text-xs font-semibold text-primary hover:underline">{isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}</button><p className="mt-7 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck size={14} className="text-primary" /> Securely managed by Supabase Auth</p></div></main>;
}

const AuthContext = createContext<AuthUser | null>(null);

export function useCurrentUser() {
  return useContext(AuthContext);
}

type ManagedUser = { id: string; email?: string; fullName: string | null; role: 'admin' | 'superadmin' | null; createdAt: string };

export function AdminDashboard() {
  const user = useCurrentUser();
  const summary = useGetMemberSummary({ databaseId: 'supabase-members' }, { query: { queryKey: getGetMemberSummaryQueryKey({ databaseId: 'supabase-members' }) } });
  const isSuperadmin = user?.role === 'superadmin';
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [savingUserId, setSavingUserId] = useState('');
  const loadUsers = async () => {
    if (!isSuperadmin || !supabase) return;
    setUsersLoading(true);
    const session = (await supabase.auth.getSession()).data.session;
    const response = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
    if (!response.ok) setUsersError((await response.json().catch(() => ({}))).error ?? 'Could not load users.');
    else { setManagedUsers(await response.json()); setUsersError(''); }
    setUsersLoading(false);
  };
  useEffect(() => { void loadUsers(); }, [isSuperadmin]);
  const changeRole = async (target: ManagedUser, role: 'admin' | 'remove') => {
    if (!supabase || !window.confirm(role === 'admin' ? `Give ${target.email} admin access?` : `Remove admin access from ${target.email}?`)) return;
    setSavingUserId(target.id);
    const session = (await supabase.auth.getSession()).data.session;
    const response = await fetch(`/api/admin/users/${target.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ role }) });
    if (!response.ok) setUsersError((await response.json().catch(() => ({}))).error ?? 'Could not change role.');
    else await loadUsers();
    setSavingUserId('');
  };
  return <div className="mx-auto max-w-5xl animate-rise"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.15em] text-primary">Administration</p><h1 className="font-display text-5xl leading-none">Control center.</h1><p className="mt-4 text-sm text-muted-foreground">Welcome, {user?.fullName || user?.email || 'administrator'}.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-secondary-foreground"><ShieldCheck size={14} />{isSuperadmin ? 'Superadmin' : 'Admin'}</span></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5"><p className="text-xs font-semibold text-muted-foreground">Member records</p><p className="mt-4 font-display text-4xl">{summary.isLoading ? '—' : summary.data?.total ?? 0}</p></div><div className="rounded-xl border border-border bg-card p-5"><p className="text-xs font-semibold text-muted-foreground">Updated this month</p><p className="mt-4 font-display text-4xl">{summary.isLoading ? '—' : summary.data?.recentlyUpdated ?? 0}</p></div><div className="rounded-xl border border-border bg-card p-5"><p className="text-xs font-semibold text-muted-foreground">Ministry interests</p><p className="mt-4 font-display text-4xl">{summary.isLoading ? '—' : summary.data?.ministryInterestCount ?? 0}</p></div></div><div className="mt-6 rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-3"><UsersRound className="text-primary" size={20} /><div><h2 className="font-display text-xl">Access level</h2><p className="mt-1 text-sm text-muted-foreground">{isSuperadmin ? 'You have the highest authorization level and can manage administrator access.' : 'You can manage member records. Superadmin privileges are required to manage administrator access.'}</p></div></div></div>{isSuperadmin && <section className="mt-6 rounded-xl border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-display text-xl">Role management</h2><p className="mt-1 text-xs text-muted-foreground">Grant or remove access to the member records app.</p></div><UserRound className="text-primary" size={20} /></div>{usersError && <p className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{usersError}</p>}{usersLoading ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : <div className="grid gap-2">{managedUsers.map((managedUser) => <div key={managedUser.id} className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{managedUser.fullName || 'Unnamed account'}</p><p className="truncate text-xs text-muted-foreground">{managedUser.email}</p></div><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{managedUser.role || 'No access'}</span>{managedUser.id !== user?.id && managedUser.role !== 'superadmin' && <div className="flex gap-2"><button type="button" disabled={savingUserId === managedUser.id} onClick={() => void changeRole(managedUser, managedUser.role === 'admin' ? 'remove' : 'admin')} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">{savingUserId === managedUser.id ? 'Saving…' : managedUser.role === 'admin' ? 'Remove admin' : 'Make admin'}</button></div>}</div>)}</div>}</section>}</div>;
}

type AuditLog = { id: string; actorEmail: string; action: string; entityType: string; entityId: string | null; details: Record<string, unknown>; createdAt: string };

export function AuditPanel() {
  const user = useCurrentUser();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (user?.role !== 'superadmin' || !supabase) return;
    setLoading(true);
    void supabase.auth.getSession().then(({ data }) => fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } })).then((response) => response.ok ? response.json() : []).then(setLogs).finally(() => setLoading(false));
  }, [user?.role]);
  if (user?.role !== 'superadmin') return null;
  return <section className="mx-auto mt-6 max-w-5xl rounded-xl border border-border bg-card p-5"><div className="mb-5"><h2 className="font-display text-xl">Admin activity</h2><p className="mt-1 text-xs text-muted-foreground">Recent member and role actions across the workspace.</p></div>{loading ? <p className="text-sm text-muted-foreground">Loading activity…</p> : logs.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : <div className="grid gap-2">{logs.map((log) => <div key={log.id} className="flex flex-col gap-1 border-b border-border py-3 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{log.action.replaceAll('_', ' ')}</p><p className="text-xs text-muted-foreground">{log.actorEmail} · {log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}</p></div><time className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</time></div>)}</div>}</section>;
}