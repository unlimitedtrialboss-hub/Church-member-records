import { useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, ChangeEvent, FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  FilePlus2,
  HeartHandshake,
  House,
  Landmark,
  Loader2,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getGetMemberQueryKey,
  getGetMemberSummaryQueryKey,
  getHealthCheckQueryKey,
  getListMembersQueryKey,
  useArchiveMember,
  useCreateMember,
  useGetMember,
  useGetMemberSummary,
  useHealthCheck,
  useListMembers,
  useUpdateMember,
} from '@workspace/api-client-react';
import type { MemberInput } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider, ThemeToggle } from '@/components/theme-provider';
import { DocumentCapture } from '@/components/document-capture';
import { AdminDashboard, AuditPanel, AuthGate } from '@/components/auth-gate';
import { supabase } from '@/lib/supabase';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type Database = { id: string; title: string; url: string; lastEditedTime: string };
const SUPABASE_DATABASE: Database = { id: 'supabase-members', title: 'Supabase member records', url: '/members', lastEditedTime: new Date().toISOString() };
type Summary = { id: string; name: string; url: string; lastEditedTime: string; gender?: string | null; civilStatus?: string | null; churchPosition?: string | null };

const blankForm: MemberInput = {
  name: '',
  databaseId: '',
  dateFilled: '',
  address: '',
  contactNumber: '',
  gender: '',
  birthDate: '',
  birthPlace: '',
  citizenship: 'Filipino',
  civilStatus: '',
  spouse: '',
  children: [],
  father: '',
  mother: '',
  emergencyContactPerson: '',
  emergencyContactNumber: '',
  hisHerAddress: '',
  elementarySchool: '',
  highSchool: '',
  college: '',
  degreeCourse: '',
  dateOfSalvation: '',
  dateOfBaptism: '',
  dateOfMembership: '',
  churchPosition: '',
  ministryInterests: [],
  otherMinistry: '',
  specialSkills: '',
};

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function displayDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IH';
}

function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-[0_6px_18px_rgba(30,90,76,.15)]',
    quiet: 'bg-transparent text-foreground hover:bg-muted',
    outline: 'border border-border bg-card text-foreground hover:bg-muted',
    danger: 'border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10',
  };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} />;
}

function TextField({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string; 'data-testid'?: string }) {
  return <label className={`grid gap-1.5 ${className}`}><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span><input {...props} data-testid={props['data-testid'] ?? `input-${props.name ?? label.toLowerCase().replaceAll(' ', '-')}`} className="h-11 rounded-lg border border-input bg-background/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>;
}

function TextArea({ label, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; className?: string; 'data-testid'?: string }) {
  return <label className={`grid gap-1.5 ${className}`}><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span><textarea {...props} data-testid={props['data-testid'] ?? `input-${props.name ?? label.toLowerCase().replaceAll(' ', '-')}`} className="min-h-24 resize-y rounded-lg border border-input bg-background/70 px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>;
}

function Badge({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'sand' | 'coral' }) {
  const styles = { teal: 'bg-primary/10 text-primary', sand: 'bg-secondary text-secondary-foreground', coral: 'bg-accent/15 text-accent-foreground' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

function Shell({ children, selectedDatabase, onClearDatabase }: { children: ReactNode; selectedDatabase?: Database; onClearDatabase: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const nav = [
    { href: '/', label: 'Directory', icon: House },
    { href: '/admin', label: 'Dashboard', icon: ShieldCheck },
    { href: '/members/new', label: 'Add member', icon: FilePlus2 },
  ];
  return <div className="grain min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-9 flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"><Landmark size={21} /></div>
        <div><p className="font-display text-lg leading-none">Heritage</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.17em] opacity-60">Member records</p></div>
      </div>
      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.18em] opacity-45">Workspace</p>
      <nav className="grid gap-1">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'opacity-75 hover:bg-sidebar-accent/70 hover:opacity-100'}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{href === '/members/new' && <span className="ml-auto text-lg leading-none opacity-50">+</span>}</Link>)}
      </nav>
      <div className="mt-auto">
        <div className="mb-5 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3.5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={15} className="text-sidebar-primary" /> Secure registry</div>
          <p className="text-[11px] leading-relaxed opacity-60">Your records are synced privately with your church workspace.</p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono-ui uppercase tracking-wider opacity-55"><span className={`size-1.5 rounded-full ${health.isError ? 'bg-accent' : 'bg-sidebar-primary'}`} />{health.isError ? 'Offline mode' : 'Connected'}</div>
        </div>
        <div className="flex items-center gap-2 border-t border-sidebar-border px-2 pt-4"><div className="grid size-8 place-items-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">IH</div><div className="min-w-0"><p className="truncate text-xs font-semibold">Church office</p><p className="text-[10px] opacity-55">Dagupan City</p></div><button type="button" onClick={() => void supabase?.auth.signOut()} className="ml-auto text-[10px] font-semibold opacity-60 hover:opacity-100">Sign out</button></div>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close menu" data-testid="button-close-menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-foreground/20 md:hidden" />}
    <main className="min-h-[100dvh] md:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:px-10">
        <button aria-label="Open menu" data-testid="button-open-menu" onClick={() => setMobileOpen(true)} className="rounded-md p-2 hover:bg-muted md:hidden"><Menu size={20} /></button>
        <div className="hidden text-xs font-semibold text-muted-foreground sm:block"><span className="text-primary">IHBC</span><span className="mx-2 opacity-40">/</span>{selectedDatabase?.title || 'Supabase member records'}</div>
        <div className="ml-auto flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" />Private workspace</div><ThemeToggle />{selectedDatabase && <button onClick={onClearDatabase} data-testid="button-switch-database" className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Switch registry</button>}</div>
      </header>
      <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-10 md:py-10">{children}</div>
    </main>
  </div>;
}

function DatabasePicker({ databases, isLoading, onSelect, error }: { databases?: Database[]; isLoading: boolean; onSelect: (db: Database) => void; error: boolean }) {
  const [query, setQuery] = useState('');
  const filtered = (Array.isArray(databases) ? databases : []).filter((db) => db.title.toLowerCase().includes(query.toLowerCase()));
  return <div className="mx-auto max-w-3xl animate-rise">
     <div className="mb-10 max-w-xl"><Badge tone="sand">Connect your member tables</Badge><h1 className="mt-4 font-display text-5xl leading-[.98] tracking-tight text-primary md:text-6xl">A good record<br /><em className="font-normal text-accent">keeps a story.</em></h1><p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">Choose the Personal Information table. Family Information and Church and Ministry Information will be linked automatically when you save a member.</p></div>
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_16px_45px_rgba(38,69,61,.06)] md:p-6">
       <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-display text-2xl">Your member tables</h2><p className="mt-1 text-xs text-muted-foreground">Select Personal Information as the main member registry.</p></div><Landmark className="text-accent" size={23} /></div>
      {(databases?.length ?? 0) > 2 && <div className="relative mb-4"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-search-databases" placeholder="Find a database" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></div>}
      {isLoading && <div className="grid gap-2">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-16 rounded-xl" />)}</div>}
      {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">We couldn’t load your Supabase records. Please refresh and try again.</div>}
      {!isLoading && !error && filtered.length === 0 && <div className="rounded-xl bg-muted/70 p-8 text-center"><ClipboardList className="mx-auto text-muted-foreground" size={28} /><p className="mt-3 text-sm font-semibold">No member records found</p><p className="mt-1 text-xs text-muted-foreground">Add your first member record to begin.</p></div>}
       <div className="grid gap-2">{filtered.map((db) => <button key={db.id} onClick={() => onSelect(db)} data-testid={`button-select-database-${db.id}`} className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-muted/60 p-3 text-left transition-all hover:border-primary/25 hover:bg-primary/5"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><BookOpen size={18} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{db.title}</p><p className="mt-1 text-xs text-muted-foreground">{db.title === 'Personal Information' ? 'Main member table · ' : 'Linked table · '}Updated {displayDate(db.lastEditedTime)}</p></div><ChevronDown className="-rotate-90 text-muted-foreground transition-transform group-hover:translate-x-1" size={17} /></button>)}</div>
    </div>
    <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck size={14} className="text-primary" /> Your connection stays private to your church workspace.</p>
  </div>;
}

function Home() {
  const selectedDatabase = SUPABASE_DATABASE;
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ databaseId: selectedDatabase?.id ?? '', ...(search ? { query: search } : {}) }), [selectedDatabase?.id, search]);
  const membersQuery = useListMembers(params, { query: { queryKey: getListMembersQueryKey(params), enabled: Boolean(selectedDatabase?.id) } });
  const summaryQuery = useGetMemberSummary({ databaseId: selectedDatabase?.id ?? '' }, { query: { queryKey: getGetMemberSummaryQueryKey({ databaseId: selectedDatabase?.id ?? '' }), enabled: Boolean(selectedDatabase?.id) } });
  const stats = summaryQuery.data;
  return <Shell selectedDatabase={selectedDatabase} onClearDatabase={() => undefined}>
    <div className="animate-rise">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-primary"><span className="size-2 rounded-full bg-accent" />Member registry</div><h1 className="font-display text-5xl leading-none tracking-tight md:text-6xl">The people<br /><span className="text-accent">behind the pews.</span></h1><p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">A living directory for International Heritage Baptist Church — Dagupan City.</p></div><Link href="/members/new" data-testid="link-add-member-hero" className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_6px_18px_rgba(30,90,76,.15)] transition-all hover:brightness-110"><FilePlus2 size={17} />Add a member</Link></div>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">{[
        { label: 'Total members', value: stats?.total ?? 0, icon: UsersRound, color: 'bg-primary text-primary-foreground' },
        { label: 'Updated this month', value: stats?.recentlyUpdated ?? 0, icon: Sparkles, color: 'bg-secondary text-secondary-foreground' },
        { label: 'Serving interests', value: stats?.ministryInterestCount ?? 0, icon: HeartHandshake, color: 'bg-accent/15 text-accent-foreground' },
      ].map(({ label, value, icon: Icon, color }, index) => <div key={label} className={`animate-rise-${index + 1} animate-rise rounded-xl border border-border bg-card p-4 shadow-[0_8px_25px_rgba(38,69,61,.035)]`}><div className="flex items-start justify-between"><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className={`grid size-8 place-items-center rounded-lg ${color}`}><Icon size={16} /></div></div><p data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-4 font-display text-4xl">{summaryQuery.isLoading ? '—' : value}</p></div>)}</div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-2xl">Member directory</h2><p className="mt-1 text-xs text-muted-foreground">{membersQuery.data?.length ?? 0} records in {selectedDatabase.title}</p></div><div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-members" placeholder="Search by name..." className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15" /></div></div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_35px_rgba(38,69,61,.04)]">
        <div className="hidden grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr_32px] gap-4 border-b border-border bg-muted/45 px-5 py-3 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground md:grid"><span>Name</span><span>Gender</span><span>Civil status</span><span>Position</span><span /></div>
        {membersQuery.isLoading && <div className="grid gap-1 p-3">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-[74px] rounded-xl" />)}</div>}
        {membersQuery.isError && <div className="p-12 text-center"><X className="mx-auto text-destructive" size={26} /><p className="mt-3 text-sm font-semibold">The directory could not be loaded</p><p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p></div>}
        {!membersQuery.isLoading && !membersQuery.isError && (membersQuery.data?.length ?? 0) === 0 && <div className="p-14 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><UsersRound size={22} /></div><p className="mt-4 font-display text-2xl">{search ? 'No one by that name' : 'Your directory is waiting'}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{search ? 'Try another spelling or clear your search.' : 'Add your first member record and begin building a clearer picture of your congregation.'}</p>{!search && <Link href="/members/new" data-testid="link-add-member-empty" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><FilePlus2 size={15} />Add first member</Link>}</div>}
        <div className="divide-y divide-border">{(membersQuery.data as Summary[] | undefined)?.map((member) => <Link href={`/members/${member.id}`} key={member.id} data-testid={`link-member-${member.id}`} className="group grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-primary/[.035] md:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr_32px] md:items-center md:gap-4"><div className="flex items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-xs font-bold text-secondary-foreground">{initials(member.name)}</div><div className="min-w-0"><p data-testid={`text-member-name-${member.id}`} className="truncate text-sm font-semibold">{member.name}</p><p className="mt-1 text-[11px] text-muted-foreground md:hidden">{member.churchPosition || member.civilStatus || 'Member record'}</p></div></div><span className="hidden text-xs text-muted-foreground md:block">{member.gender || '—'}</span><span className="hidden text-xs text-muted-foreground md:block">{member.civilStatus || '—'}</span><span className="hidden text-xs text-muted-foreground md:block">{member.churchPosition || 'Member'}</span><ChevronDown className="-rotate-90 text-muted-foreground transition-transform group-hover:translate-x-1" size={17} /></Link>)}</div>
      </div>
      <p className="mt-5 text-center text-[11px] text-muted-foreground">Synced with Supabase</p>
    </div>
  </Shell>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="border-t border-border pt-7"><div className="mb-5 grid gap-1 md:grid-cols-[190px_1fr] md:gap-7"><div><h2 className="font-display text-xl">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div><div className="grid gap-4">{children}</div></div></section>;
}

function MemberForm({ memberId, database, initial }: { memberId?: string; database?: Database; initial?: Partial<MemberInput> }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MemberInput>(() => ({
    ...blankForm,
    databaseId: database?.id ?? initial?.databaseId ?? '',
    name: text(initial?.name),
    dateFilled: dateOnly(initial?.dateFilled),
    address: text(initial?.address),
    contactNumber: text(initial?.contactNumber),
    gender: text(initial?.gender),
    birthDate: dateOnly(initial?.birthDate),
    birthPlace: text(initial?.birthPlace),
    citizenship: text(initial?.citizenship) || 'Filipino',
    civilStatus: text(initial?.civilStatus),
    spouse: text(initial?.spouse),
    father: text(initial?.father),
    mother: text(initial?.mother),
    emergencyContactPerson: text(initial?.emergencyContactPerson),
    emergencyContactNumber: text(initial?.emergencyContactNumber),
    hisHerAddress: text(initial?.hisHerAddress),
    elementarySchool: text(initial?.elementarySchool),
    highSchool: text(initial?.highSchool),
    college: text(initial?.college),
    degreeCourse: text(initial?.degreeCourse),
    dateOfSalvation: dateOnly(initial?.dateOfSalvation),
    dateOfBaptism: dateOnly(initial?.dateOfBaptism),
    dateOfMembership: dateOnly(initial?.dateOfMembership),
    churchPosition: text(initial?.churchPosition),
    otherMinistry: text(initial?.otherMinistry),
    specialSkills: text(initial?.specialSkills),
    children: initial?.children ?? [],
    ministryInterests: initial?.ministryInterests ?? [],
  }));
  const [childrenText, setChildrenText] = useState((initial?.children ?? []).join(', '));
  const [ministryText, setMinistryText] = useState((initial?.ministryInterests ?? []).join(', '));
  const [saved, setSaved] = useState(false);
  const create = useCreateMember();
  const update = useUpdateMember();
  const archive = useArchiveMember();
  const isPending = create.isPending || update.isPending;
  const setField = (key: keyof MemberInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload: MemberInput = {
      ...form,
      name: form.name.trim(),
      children: childrenText.split(',').map((item) => item.trim()).filter(Boolean),
      ministryInterests: ministryText.split(',').map((item) => item.trim()).filter(Boolean),
    };
    if (!payload.name) return;
    const onSuccess = (result: { id: string }) => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey({ databaseId: database?.id ?? '' }) });
      queryClient.invalidateQueries({ queryKey: getGetMemberSummaryQueryKey({ databaseId: database?.id ?? '' }) });
      if (memberId) queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId, { databaseId: database?.id ?? '' }) });
      if (!memberId) setLocation(`/members/${result.id}`);
    };
    if (memberId) update.mutate({ id: memberId, data: payload }, { onSuccess });
    else create.mutate({ data: payload }, { onSuccess });
  };
  const archiveRecord = () => {
    if (!memberId || !window.confirm('Archive this member record? It will be removed from the active directory.')) return;
    archive.mutate({ id: memberId }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMembersQueryKey({ databaseId: database?.id ?? '' }) }); queryClient.invalidateQueries({ queryKey: getGetMemberSummaryQueryKey({ databaseId: database?.id ?? '' }) }); queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId, { databaseId: database?.id ?? '' }) }); setLocation('/'); } });
  };
  const applyScannedFields = (fields: Partial<MemberInput>) => setForm((current) => ({ ...current, ...fields }));
  const input = (key: keyof MemberInput) => ({ value: text(form[key]), onChange: (event: ChangeEvent<HTMLInputElement>) => setField(key, event.target.value) });
  return <form onSubmit={submit} className="animate-rise">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/" data-testid="link-back-directory" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={14} />Back to directory</Link><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><CircleUserRound size={25} /></div><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{memberId ? 'Member record' : 'New record'}</p><h1 className="font-display text-4xl leading-tight md:text-5xl">{memberId ? (form.name || 'Edit member') : 'Welcome someone new.'}</h1></div></div></div><div className="flex items-center gap-2">{memberId && <Button type="button" variant="danger" onClick={archiveRecord} disabled={archive.isPending} data-testid="button-archive-member">{archive.isPending ? <Loader2 className="animate-spin" size={15} /> : <Archive size={15} />}Archive</Button>}<Button type="submit" disabled={isPending || !form.name.trim()} data-testid="button-save-member">{isPending ? <Loader2 className="animate-spin" size={16} /> : saved ? <Check size={16} /> : null}{isPending ? 'Saving…' : saved ? 'Saved' : memberId ? 'Save changes' : 'Submit member'}</Button></div></div><div className="mb-7"><DocumentCapture onExtract={applyScannedFields} /></div>
     <div className="mb-7 rounded-xl border border-primary/15 bg-primary/[.045] px-4 py-3 text-xs text-primary"><div className="flex items-center gap-2 font-semibold"><ShieldCheck size={15} /> A respectful record, kept with care.</div><p className="mt-1 pl-5 text-primary/70">Fill what you know today. You can always return and complete the story later.</p></div>
    {(create.isError || update.isError) && <div role="alert" className="mb-7 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"><p className="font-semibold">This record could not be saved.</p><p className="mt-1 text-xs">{(create.error ?? update.error) instanceof Error ? (create.error ?? update.error)?.message : 'Please check the Supabase connection and try again.'}</p></div>}
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_35px_rgba(38,69,61,.04)] md:p-8">
       <FormSection title="Identity" description="The essentials for a clear member profile."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Full name" required {...input('name')} data-testid="input-member-name" className="sm:col-span-2" /><TextField label="Date filled" type="date" {...input('dateFilled')} /><label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Gender</span><select value={text(form.gender)} onChange={(e) => setField('gender', e.target.value)} data-testid="select-member-gender" className="h-11 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none focus:border-primary"><option value="">Choose gender</option><option>Female</option><option>Male</option></select></label><TextField label="Birth date" type="date" {...input('birthDate')} /><TextField label="Birth place" {...input('birthPlace')} /><label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Citizenship</span><select value={text(form.citizenship)} onChange={(e) => setField('citizenship', e.target.value)} data-testid="select-member-citizenship" className="h-11 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none focus:border-primary"><option value="">Choose citizenship</option><option>Filipino</option><option>American</option></select></label><label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Civil status</span><select value={text(form.civilStatus)} onChange={(e) => setField('civilStatus', e.target.value)} data-testid="select-civil-status" className="h-11 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none focus:border-primary"><option value="">Choose status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option></select></label><TextField label="Spouse" {...input('spouse')} /><TextField label="Children" value={childrenText} onChange={(e) => setChildrenText(e.target.value)} placeholder="Separate names with commas" data-testid="input-children" /></div></FormSection>
      <FormSection title="Contact" description="Where to reach them, and who to call when needed."><div className="grid gap-4 sm:grid-cols-2"><TextArea label="Home address" {...({ value: text(form.address), onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setField('address', e.target.value) })} className="sm:col-span-2" data-testid="input-address" /><TextField label="Contact number" type="tel" {...input('contactNumber')} /><TextField label="Emergency contact person" {...input('emergencyContactPerson')} /><TextField label="Emergency contact number" type="tel" {...input('emergencyContactNumber')} /><TextArea label="Emergency contact address" {...({ value: text(form.hisHerAddress), onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setField('hisHerAddress', e.target.value) })} data-testid="input-emergency-address" /></div></FormSection>
      <FormSection title="Background" description="A little context helps us care for the whole person."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Father" {...input('father')} /><TextField label="Mother" {...input('mother')} /><TextField label="Elementary school" {...input('elementarySchool')} /><TextField label="High school" {...input('highSchool')} /><TextField label="College / university" {...input('college')} /><TextField label="Degree or course" {...input('degreeCourse')} /></div></FormSection>
       <FormSection title="Faith journey" description="Milestones and ways they would like to serve."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Date of salvation" type="date" {...input('dateOfSalvation')} /><TextField label="Date of baptism" type="date" {...input('dateOfBaptism')} /><TextField label="Date of membership" type="date" {...input('dateOfMembership')} /><label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Current church position</span><select value={text(form.churchPosition)} onChange={(e) => setField('churchPosition', e.target.value)} data-testid="select-church-position" className="h-11 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none focus:border-primary"><option value="">Choose position</option><option>Young Professional</option><option>Young People</option><option>Adult</option><option>Elder</option><option>Pastor</option><option>Worker</option><option>Member</option></select></label><TextField label="Ministry interests" value={ministryText} onChange={(e) => setMinistryText(e.target.value)} placeholder="e.g. Music, Children, Outreach" data-testid="input-ministry-interests" className="sm:col-span-2" /><TextField label="Other ministry" {...input('otherMinistry')} /><TextArea label="Special skills" {...({ value: text(form.specialSkills), onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setField('specialSkills', e.target.value) })} data-testid="input-special-skills" /></div></FormSection>
    </div>
     <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">When you are finished, submit this record to save it in Supabase.</p>
       <Button type="submit" disabled={isPending || !form.name.trim()} data-testid="button-submit-member">
         {isPending ? <Loader2 className="animate-spin" size={16} /> : saved ? <Check size={16} /> : null}
         {isPending ? 'Submitting…' : saved ? 'Submitted' : memberId ? 'Save changes' : 'Submit member'}
       </Button>
     </div>
  </form>;
}

function NewMember({ database }: { database?: Database }) {
  const selectedDatabase = database ?? SUPABASE_DATABASE;
  return <Shell selectedDatabase={selectedDatabase} onClearDatabase={() => undefined}><MemberForm database={selectedDatabase} /></Shell>;
}

function ChooseDatabaseNotice() {
  return <Shell onClearDatabase={() => undefined}><div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Landmark size={25} /></div><h1 className="mt-5 font-display text-3xl">Supabase is ready</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your member records are stored securely in the connected Supabase database.</p><Link href="/" data-testid="link-choose-database" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Go to directory <ArrowLeft className="rotate-180" size={15} /></Link></div></Shell>;
}

function MemberDetail({ database }: { database?: Database }) {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const selectedDatabase = database ?? SUPABASE_DATABASE;
  const memberQuery = useGetMember(params.id, { databaseId: selectedDatabase.id }, { query: { queryKey: getGetMemberQueryKey(params.id, { databaseId: selectedDatabase.id }), enabled: Boolean(params.id) } });
  if (memberQuery.isLoading) return <Shell selectedDatabase={selectedDatabase} onClearDatabase={() => undefined}><div className="grid gap-4"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-[500px] rounded-2xl" /></div></Shell>;
  if (memberQuery.isError || !memberQuery.data) return <Shell selectedDatabase={selectedDatabase} onClearDatabase={() => undefined}><div className="py-20 text-center"><X className="mx-auto text-destructive" size={28} /><h1 className="mt-4 font-display text-3xl">Record unavailable</h1><Link href="/" data-testid="link-return-directory" className="mt-5 inline-flex text-sm font-semibold text-primary">Return to directory</Link></div></Shell>;
  return <Shell selectedDatabase={selectedDatabase} onClearDatabase={() => undefined}><MemberForm memberId={params.id} database={selectedDatabase} initial={memberQuery.data} /></Shell>;
}

function AppRouter() {
  const [currentLocation] = useLocation();
  const selectedDatabase = SUPABASE_DATABASE;
  return <ErrorBoundary resetKey={currentLocation}><Switch><Route path="/" component={Home} /><Route path="/admin"><Shell selectedDatabase={selectedDatabase} onClearDatabase={() => undefined}><AdminDashboard /><AuditPanel /></Shell></Route><Route path="/members/new"><NewMember database={selectedDatabase} /></Route><Route path="/members/:id"><MemberDetail database={selectedDatabase} /></Route><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <ThemeProvider><AuthGate><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRouter /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider></AuthGate></ThemeProvider>;
}

export default App;